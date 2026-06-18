import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CertService } from "../../../../crypto/key/cert/cert.service";
import { CryptoImplementationService } from "../../../../crypto/key/crypto-implementation/crypto-implementation.service";
import { KeyUsageType } from "../../../../crypto/key/entities/key-chain.entity";
import { KeyChainService } from "../../../../crypto/key/key-chain.service";
import { MediaType } from "../../../../shared/utils/mediaType/media-type.enum";
import { CredentialsService } from "../../../configuration/credentials/credentials.service";
import {
    PasoTransactionDataTypeConfig,
    PasoUiLabels,
} from "../../../configuration/credentials/dto/paso-config.dto";
import {
    CredentialConfig,
    CredentialFormat,
} from "../../../configuration/credentials/entities/credential.entity";
import { buildClaimsMetadata } from "../../../configuration/credentials/utils/derive";
import {
    CredentialMetadataDto,
    SignedCredentialMetadataJwtPayload,
} from "./dto/credential-metadata.dto";

function matchesLocale(itemLocale: string, requestedLocale: string): boolean {
    const item = itemLocale.toLowerCase();
    const req = requestedLocale.toLowerCase();
    return (
        item === req || item === req.split("-")[0] || req === item.split("-")[0]
    );
}

function filterByLocales<T extends { locale?: string }>(
    items: T[] | undefined,
    locales: string[],
): T[] | undefined {
    if (!items || items.length === 0) return items;
    if (locales.length === 0) return items;

    const result: T[] = [];
    const seen = new Set<T>();

    for (const req of locales) {
        for (const item of items) {
            if (item.locale && matchesLocale(item.locale, req)) {
                if (!seen.has(item)) {
                    seen.add(item);
                    result.push(item);
                }
            }
        }
    }

    if (result.length > 0) {
        return result;
    }

    return items;
}

@Injectable()
export class CredentialMetadataService {
    constructor(
        private readonly credentialsService: CredentialsService,
        private readonly certService: CertService,
        private readonly keyChainService: KeyChainService,
        private readonly cryptoImplementationService: CryptoImplementationService,
        private readonly configService: ConfigService,
    ) {}

    /**
     * Parse standard Accept-Language header into a priority list of locales.
     */
    parseAcceptLanguage(header: string | undefined): string[] {
        if (!header) return [];
        return header
            .split(",")
            .map((part) => {
                const [lang, qPart] = part.split(";");
                let q = 1.0;
                if (qPart) {
                    const match = qPart.match(/q=\s*([0-9.]+)/);
                    if (match) q = parseFloat(match[1]);
                }
                return { lang: lang.trim().toLowerCase(), q };
            })
            .filter((x) => x.lang)
            .sort((a, b) => b.q - a.q)
            .map((x) => x.lang);
    }

    /**
     * Extract the VCT string (whether it's string, object or hosted URL).
     */
    private getVctString(
        credential: CredentialConfig,
        tenantId: string,
        publicUrl: string,
    ): string {
        if (typeof credential.vct === "string") {
            return credential.vct;
        }
        if (
            credential.vct &&
            typeof credential.vct === "object" &&
            "vct" in credential.vct &&
            typeof (credential.vct as any).vct === "string"
        ) {
            return (credential.vct as any).vct;
        }
        return `${publicUrl}/issuers/${tenantId}/credentials-metadata/vct/${credential.id}`;
    }

    /**
     * Build the OID4VCI credential metadata document filtered by locales.
     */
    buildCredentialMetadata(
        credential: CredentialConfig,
        locales: string[],
    ): CredentialMetadataDto {
        const display = filterByLocales(credential.config.display, locales);
        const claims = buildClaimsMetadata(credential.fields as any).map(
            (claim) => {
                return {
                    path: claim.path,
                    mandatory: claim.mandatory,
                    display: filterByLocales(claim.display, locales),
                };
            },
        );

        const metadata: CredentialMetadataDto = {
            ...(display && { display }),
            ...(claims.length > 0 && { claims }),
        };

        if (credential.paso?.transactionDataTypes) {
            const transactionDataTypes: Record<
                string,
                PasoTransactionDataTypeConfig
            > = {};

            for (const [urn, config] of Object.entries(
                credential.paso.transactionDataTypes,
            )) {
                const filteredClaims = config.claims.map((claim) => {
                    return {
                        path: claim.path,
                        mandatory: claim.mandatory,
                        display: filterByLocales(claim.display, locales),
                        ...(claim.value_type && {
                            value_type: claim.value_type,
                        }),
                    };
                });

                const filteredUiLabels: Record<string, any> = {};
                if (config.ui_labels) {
                    for (const [key, val] of Object.entries(config.ui_labels)) {
                        if (Array.isArray(val)) {
                            filteredUiLabels[key] = filterByLocales(
                                val,
                                locales,
                            );
                        } else {
                            filteredUiLabels[key] = val;
                        }
                    }
                }

                transactionDataTypes[urn] = {
                    claims: filteredClaims,
                    ...(config.ui_labels && {
                        ui_labels: filteredUiLabels as PasoUiLabels,
                    }),
                };
            }
            metadata.transaction_data_types = transactionDataTypes;
        }

        return metadata;
    }

    /**
     * Main handler to serve credential metadata as JSON or signed JWT.
     */
    async getMetadataDocument(
        tenantId: string,
        credentialId: string,
        mediaType: MediaType,
        acceptLanguage?: string,
    ): Promise<{ body: any; contentType: MediaType }> {
        const credential = await this.credentialsService.getCredentialConfig(
            credentialId,
            tenantId,
        );

        if (!credential) {
            throw new NotFoundException(
                `Credential configuration ${credentialId} not found`,
            );
        }

        let locales = this.parseAcceptLanguage(acceptLanguage);
        if (locales.length === 0) {
            const displayLocale = credential.config.display?.[0]?.locale;
            locales = displayLocale ? [displayLocale] : ["en"];
        }

        const metadata = this.buildCredentialMetadata(credential, locales);

        if (mediaType === MediaType.APPLICATION_JSON) {
            return {
                body: metadata,
                contentType: MediaType.APPLICATION_JSON,
            };
        }

        const cert = await this.certService.find({
            tenantId,
            type: KeyUsageType.Attestation,
            keyId: credential.keyChainId,
        });

        const publicUrl = this.configService.getOrThrow<string>("PUBLIC_URL");
        const credential_metadata_uri = `${publicUrl}/.well-known/openid-credential-issuer/issuers/${tenantId}/credential-metadata/${credentialId}`;

        const sub =
            credential.config.format === CredentialFormat.MSO_MDOC
                ? (credential.config.docType ?? credential.id)
                : this.getVctString(credential, tenantId, publicUrl);

        const iat = Math.floor(Date.now() / 1000);
        const exp =
            iat + (credential.paso?.signedMetadataLifetimeSeconds ?? 86400);

        const payload: SignedCredentialMetadataJwtPayload = {
            iss: `${publicUrl}/issuers/${tenantId}`,
            sub,
            format: credential.config.format,
            iat,
            exp,
            credential_metadata_uri,
            credential_metadata: metadata,
        };

        const header = {
            typ: "credential-metadata+jwt",
            alg: this.cryptoImplementationService.getAlg(),
            x5c: this.certService.getCertChain(cert),
        };

        const jwt = await this.keyChainService.signJWT(
            payload as any,
            header,
            tenantId,
            cert.keyId,
        );

        return {
            body: jwt,
            contentType: MediaType.APPLICATION_JWT,
        };
    }
}
