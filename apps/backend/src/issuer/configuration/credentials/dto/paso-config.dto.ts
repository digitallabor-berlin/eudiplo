import {
    ApiProperty,
    ApiPropertyOptional,
    getSchemaPath,
} from "@nestjs/swagger";
import { plainToInstance, Transform, Type } from "class-transformer";
import {
    IsArray,
    IsBoolean,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Validate,
    ValidateNested,
    ValidationArguments,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    validateSync,
} from "class-validator";

@ValidatorConstraint({ name: "valueTypeOnlyWithDisplay", async: false })
export class ValueTypeOnlyWithDisplayConstraint
    implements ValidatorConstraintInterface
{
    validate(value_type: string | undefined, args: ValidationArguments) {
        const object = args.object as any;
        if (value_type !== undefined && value_type !== null) {
            return (
                object.display !== undefined &&
                Array.isArray(object.display) &&
                object.display.length > 0
            );
        }
        return true;
    }

    defaultMessage(args: ValidationArguments) {
        return "value_type can only be specified when display is present and not empty";
    }
}

@ValidatorConstraint({ name: "pasoTransactionDataTypesKeys", async: false })
export class PasoTransactionDataTypesKeysConstraint
    implements ValidatorConstraintInterface
{
    validate(
        transactionDataTypes: Record<string, any> | undefined,
        args: ValidationArguments,
    ) {
        if (!transactionDataTypes) return true;
        // Reject array-shaped payloads outright. A FormArray-shaped `[]` would
        // otherwise be coerced into an empty `{}` by the @Transform below,
        // silently persisting a paso block with no transaction data types.
        if (Array.isArray(transactionDataTypes)) return false;
        const keys = Object.keys(transactionDataTypes);
        const regex = /^urn:paso:sca:[^:]+:[^:]+:[^:]+$/;
        return keys.every((key) => regex.test(key));
    }

    defaultMessage(args: ValidationArguments) {
        const value = (args?.object as { transactionDataTypes?: unknown })
            ?.transactionDataTypes;
        if (Array.isArray(value)) {
            return "transactionDataTypes must be an object keyed by URN, not an array.";
        }
        return "Each key in transactionDataTypes must match the pattern urn:paso:sca:<domain>:<suffix>:<version>";
    }
}

@ValidatorConstraint({ name: "pasoTransactionDataTypesNonEmpty", async: false })
export class PasoTransactionDataTypesNonEmptyConstraint
    implements ValidatorConstraintInterface
{
    validate(
        transactionDataTypes: Record<string, any> | undefined,
        _args: ValidationArguments,
    ) {
        // A paso block with an empty Record is invalid per the PaSO Metadata
        // spec (§3 requires at least one transaction data type) and produces
        // a credential that disappears from the issuer well-known metadata.
        if (!transactionDataTypes) return false;
        if (Array.isArray(transactionDataTypes)) return false;
        return Object.keys(transactionDataTypes).length > 0;
    }

    defaultMessage(_args: ValidationArguments) {
        return "transactionDataTypes must contain at least one entry. Send `paso: null` to clear the configuration instead.";
    }
}

@ValidatorConstraint({ name: "pasoTransactionDataTypesValues", async: false })
export class PasoTransactionDataTypesValuesConstraint
    implements ValidatorConstraintInterface
{
    private errors: string[] = [];

    validate(
        transactionDataTypes: Record<string, any> | undefined,
        args: ValidationArguments,
    ) {
        if (!transactionDataTypes) return true;
        this.errors = [];

        for (const [_key, val] of Object.entries(transactionDataTypes)) {
            const validationErrors = validateSync(val);
            if (validationErrors.length > 0) {
                for (const err of validationErrors) {
                    if (err.constraints) {
                        for (const msg of Object.values(err.constraints)) {
                            this.errors.push(`${msg}`);
                        }
                    }
                    if (err.children && err.children.length > 0) {
                        for (const child of err.children) {
                            if (child.constraints) {
                                for (const msg of Object.values(
                                    child.constraints,
                                )) {
                                    this.errors.push(`${msg}`);
                                }
                            }
                            if (child.children && child.children.length > 0) {
                                for (const subChild of child.children) {
                                    if (subChild.constraints) {
                                        for (const msg of Object.values(
                                            subChild.constraints,
                                        )) {
                                            this.errors.push(`${msg}`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return this.errors.length === 0;
    }

    defaultMessage(args: ValidationArguments) {
        return `${this.errors.join(", ")}`;
    }
}

export class PasoFieldDisplay {
    @ApiProperty({
        description: "Locale code (e.g., 'en', 'de')",
        example: "en",
    })
    @IsString()
    locale!: string;

    @ApiProperty({
        description: "Display name for the field",
        example: "Amount",
    })
    @IsString()
    name!: string;

    @ApiPropertyOptional({
        description: "Optional display type",
        example: "amount",
    })
    @IsOptional()
    @IsString()
    display_type?: string;
}

export class PasoClaimMetadata {
    @ApiProperty({
        description: "Path to the claim inside the credential",
        example: ["payment_details", "amount"],
        type: "array",
        items: {
            oneOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
        },
    })
    @IsArray()
    path!: (string | number | null)[];

    @ApiPropertyOptional({
        description:
            "Indicates whether the claim is mandatory for the transaction",
        example: true,
    })
    @IsOptional()
    @IsBoolean()
    mandatory?: boolean;

    @ApiPropertyOptional({
        description: "Localized display information for the claim",
        type: () => [PasoFieldDisplay],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PasoFieldDisplay)
    display?: PasoFieldDisplay[];

    @ApiPropertyOptional({
        description: "Type of value (only allowed if display is present)",
        example: "currency-amount",
    })
    @IsOptional()
    @IsString()
    @Validate(ValueTypeOnlyWithDisplayConstraint)
    value_type?: string;
}

export class PasoUiLabelEntry {
    @ApiPropertyOptional({
        description: "Locale code (e.g., 'en')",
        example: "en",
    })
    @IsOptional()
    @IsString()
    locale?: string;

    @ApiProperty({
        description: "The text value of the UI label",
        example: "Do you want to authorize this payment?",
    })
    @IsString()
    value!: string;

    @ApiPropertyOptional({
        description: "Optional value type designation",
        example: "text/markdown",
    })
    @IsOptional()
    @IsString()
    value_type?: string;
}

export class PasoUiLabels {
    @ApiPropertyOptional({
        description: "Label for the affirmative action",
        type: () => [PasoUiLabelEntry],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PasoUiLabelEntry)
    affirmative_action_label?: PasoUiLabelEntry[];

    @ApiPropertyOptional({
        description: "Label for the denial action",
        type: () => [PasoUiLabelEntry],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PasoUiLabelEntry)
    denial_action_label?: PasoUiLabelEntry[];

    @ApiPropertyOptional({
        description: "Title for the transaction UI",
        type: () => [PasoUiLabelEntry],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PasoUiLabelEntry)
    transaction_title?: PasoUiLabelEntry[];

    @ApiPropertyOptional({
        description: "Security hint for the user",
        type: () => [PasoUiLabelEntry],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PasoUiLabelEntry)
    security_hint?: PasoUiLabelEntry[];
}

export class PasoTransactionDataTypeConfig {
    @ApiProperty({
        description: "Claims included in this transaction data type",
        type: () => [PasoClaimMetadata],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PasoClaimMetadata)
    claims!: PasoClaimMetadata[];

    @ApiPropertyOptional({
        description: "UI labels for the transaction UI",
        type: () => PasoUiLabels,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => PasoUiLabels)
    ui_labels?: PasoUiLabels;
}

export class PasoConfig {
    @ApiProperty({
        type: "object",
        additionalProperties: {
            $ref: getSchemaPath(PasoTransactionDataTypeConfig),
        },
        description: "A map of PaSO transaction data types keyed by URN",
    })
    @IsObject()
    @Transform(({ value }) => {
        // Pass arrays through untouched so the keys-validator can reject them
        // with a clear error, instead of silently coercing into `{}`.
        if (!value || typeof value !== "object" || Array.isArray(value))
            return value;
        const res: Record<string, PasoTransactionDataTypeConfig> = {};
        for (const [key, val] of Object.entries(value)) {
            res[key] = plainToInstance(PasoTransactionDataTypeConfig, val);
        }
        return res;
    })
    // Do NOT add `@ValidateNested({ each: true })` here. class-validator only
    // iterates Array/Set/Map for `each`; on a plain Record it falls into
    // `execute(value, 'PasoConfig', ...)` which re-runs the whitelist over
    // the Record's dynamic URN keys, strips every one of them, and silently
    // persists `transactionDataTypes: {}`. PasoTransactionDataTypesValuesConstraint
    // handles nested validation explicitly via `validateSync(val)` instead.
    @Validate(PasoTransactionDataTypesKeysConstraint)
    @Validate(PasoTransactionDataTypesNonEmptyConstraint)
    @Validate(PasoTransactionDataTypesValuesConstraint)
    transactionDataTypes!: Record<string, PasoTransactionDataTypeConfig>;

    @ApiPropertyOptional({
        description:
            "Lifetime of the signed metadata JWT in seconds. Default is 86400 (24 hours).",
        example: 86400,
        default: 86400,
    })
    @IsOptional()
    @IsNumber()
    signedMetadataLifetimeSeconds?: number;
}
