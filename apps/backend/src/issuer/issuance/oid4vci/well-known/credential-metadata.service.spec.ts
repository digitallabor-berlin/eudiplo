import { describe, expect, it } from "vitest";
import {
    CredentialConfig,
    CredentialFormat,
} from "../../../configuration/credentials/entities/credential.entity";
import { CredentialMetadataService } from "./credential-metadata.service";

const credentialsServiceMock = {} as any;
const certServiceMock = {} as any;
const keyChainServiceMock = {} as any;
const cryptoImplementationServiceMock = {} as any;
const configServiceMock = {} as any;

describe("CredentialMetadataService", () => {
    const service = new CredentialMetadataService(
        credentialsServiceMock,
        certServiceMock,
        keyChainServiceMock,
        cryptoImplementationServiceMock,
        configServiceMock,
    );

    describe("parseAcceptLanguage", () => {
        it("should parse multiple languages with q-values in correct priority order", () => {
            const result = service.parseAcceptLanguage(
                "de, en;q=0.8, fr-CA;q=0.9",
            );
            expect(result).toEqual(["de", "fr-ca", "en"]);
        });

        it("should return empty array for undefined or empty header", () => {
            expect(service.parseAcceptLanguage(undefined)).toEqual([]);
            expect(service.parseAcceptLanguage("")).toEqual([]);
        });
    });

    describe("buildCredentialMetadata", () => {
        const mockCredential = {
            id: "sca-payment",
            config: {
                format: CredentialFormat.SD_JWT_VC,
                display: [
                    { name: "SCA Card", locale: "en", description: "En desc" },
                    { name: "SCA Karte", locale: "de", description: "De desc" },
                ],
            },
            fields: [
                {
                    path: ["payment_details", "amount"],
                    type: "string",
                    mandatory: true,
                    display: [
                        { locale: "en", name: "Amount" },
                        { locale: "de", name: "Betrag" },
                    ],
                },
            ],
            paso: {
                transactionDataTypes: {
                    "urn:paso:sca:global:payment:1": {
                        claims: [
                            {
                                path: ["payment_details", "amount"],
                                mandatory: true,
                                display: [
                                    {
                                        locale: "en",
                                        name: "Amount",
                                        display_type: "amount",
                                    },
                                    {
                                        locale: "de",
                                        name: "Betrag",
                                        display_type: "amount",
                                    },
                                ],
                                value_type: "currency-amount",
                            },
                        ],
                        ui_labels: {
                            affirmative_action_label: [
                                { locale: "en", value: "Authorize" },
                                { locale: "de", value: "Freigeben" },
                            ],
                        },
                    },
                },
            },
        } as unknown as CredentialConfig;

        it("should filter displays, claim displays, and PaSO transaction displays/labels to the requested locales", () => {
            const result = service.buildCredentialMetadata(mockCredential, [
                "de",
            ]);

            // Display should be only "de"
            expect(result.display).toEqual([
                { name: "SCA Karte", locale: "de", description: "De desc" },
            ]);

            // Claims display should be filtered to "de"
            expect(result.claims?.[0].display).toEqual([
                { locale: "de", name: "Betrag" },
            ]);

            // PaSO transaction data types should be filtered to "de"
            const pasoTDT =
                result.transaction_data_types?.[
                    "urn:paso:sca:global:payment:1"
                ];
            expect(pasoTDT).toBeDefined();
            expect(pasoTDT?.claims[0].display).toEqual([
                { locale: "de", name: "Betrag", display_type: "amount" },
            ]);
            expect(pasoTDT?.ui_labels?.affirmative_action_label).toEqual([
                { locale: "de", value: "Freigeben" },
            ]);
        });

        it("should return fallback display list if requested locale has no matches", () => {
            const result = service.buildCredentialMetadata(mockCredential, [
                "fr",
            ]);

            // Since "fr" does not exist in any display or label list, it should return all/fallbacks
            expect(result.display).toEqual(mockCredential.config.display);
            expect(result.claims?.[0].display).toEqual([
                { locale: "en", name: "Amount" },
                { locale: "de", name: "Betrag" },
            ]);
        });
    });
});
