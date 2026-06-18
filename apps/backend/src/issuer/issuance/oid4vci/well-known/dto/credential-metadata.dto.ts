import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PasoTransactionDataTypeConfig } from "../../../../configuration/credentials/dto/paso-config.dto";
import { Display } from "../../../../configuration/credentials/entities/credential.entity";

export class ClaimDisplayDto {
    @ApiPropertyOptional({
        description: "Name of the claim",
        example: "Given Name",
    })
    name?: string;

    @ApiPropertyOptional({
        description: "Locale code of the claim name",
        example: "en",
    })
    locale?: string;
}

export class ClaimMetadataDto {
    @ApiProperty({
        description: "Path to the claim within the credential structure",
        example: ["given_name"],
        type: "array",
        items: {
            oneOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
        },
    })
    path!: (string | number | null)[];

    @ApiPropertyOptional({
        description: "Whether the claim is mandatory for issuance",
        example: true,
    })
    mandatory?: boolean;

    @ApiPropertyOptional({
        description: "Localized display names for the claim",
        type: () => [ClaimDisplayDto],
    })
    display?: ClaimDisplayDto[];
}

export class CredentialMetadataDto {
    @ApiPropertyOptional({
        description: "Localized display information for the credential",
        type: () => [Display],
    })
    display?: Display[];

    @ApiPropertyOptional({
        description: "Schema properties and claim-level metadata",
        type: () => [ClaimMetadataDto],
    })
    claims?: ClaimMetadataDto[];

    @ApiPropertyOptional({
        description: "PaSO transaction data types mapped by their URNs",
        type: "object",
        additionalProperties: {
            $ref: "#/components/schemas/PasoTransactionDataTypeConfig",
        },
    })
    transaction_data_types?: Record<string, PasoTransactionDataTypeConfig>;
}

export class SignedCredentialMetadataJwtPayload {
    @ApiProperty({
        description: "Issuer identifier URL",
        example: "https://example.com/issuers/tenant-1",
    })
    iss!: string;

    @ApiProperty({
        description: "Subject matching the credential type (vct or docType)",
        example: "https://bank.example/sca/card",
    })
    sub!: string;

    @ApiProperty({
        description:
            "Format of the credential (e.g., 'dc+sd-jwt' or 'mso_mdoc')",
        example: "dc+sd-jwt",
    })
    format!: string;

    @ApiProperty({
        description: "Issued at timestamp (seconds)",
        example: 1718611200,
    })
    iat!: number;

    @ApiProperty({
        description: "Expiration timestamp (seconds)",
        example: 1718697600,
    })
    exp!: number;

    @ApiProperty({
        description:
            "The discoverable canonical URL for this credential metadata",
        example:
            "https://example.com/.well-known/openid-credential-issuer/issuers/tenant-1/credential-metadata/sca-payment",
    })
    credential_metadata_uri!: string;

    @ApiProperty({
        description: "The unsigned OID4VCI credential metadata object",
        type: () => CredentialMetadataDto,
    })
    credential_metadata!: CredentialMetadataDto;
}
