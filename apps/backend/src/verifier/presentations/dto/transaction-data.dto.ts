import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsObject, IsString, ValidateNested } from "class-validator";
import { IsPaSOTransactionType } from "../validators/paso-transaction-type.validator";

/**
 * PaSO Transaction Data Payload
 * Represents the dynamic JSON object defined by the applicable Transaction Data Type Rulebook.
 */
export class TransactionDataPayloadDTO {
    // We use an index signature with 'unknown' to enforce strict type-checking on access
    // and prevent prototype pollution while allowing dynamic rulebook payloads.
    [key: string]: unknown;
}

/**
 * PaSO Transaction Data Entry
 * Required for Strong Customer Authentication (SCA) and payments via OID4VP.
 */
export class TransactionDataDTO {
    @ApiProperty({
        description:
            "Transaction data type identifier following the PaSO rulebook URN scheme.",
        example: "urn:paso:sca:com.example.payments:payment:1",
    })
    @IsString()
    @IsPaSOTransactionType()
    type!: string;

    @ApiProperty({
        type: [String],
        description:
            "Array of credential query identifiers that this transaction data applies to. Used for resolving DCQL queries.",
        example: ["sca_card"],
    })
    @IsArray()
    @IsString({ each: true })
    credential_ids!: string[];

    @ApiProperty({
        description:
            "JSON object containing the transaction details compliant with the specified rulebook.",
    })
    @IsObject()
    @ValidateNested()
    @Type(() => TransactionDataPayloadDTO)
    payload!: TransactionDataPayloadDTO;
}
