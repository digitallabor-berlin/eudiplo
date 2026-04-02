import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from "class-validator";

/**
 * Validates that the transaction data type adheres to the PaSO core spec.
 * URN must start with "urn:paso:sca:"
 */
@ValidatorConstraint({ async: false })
export class IsPaSOTransactionTypeConstraint
    implements ValidatorConstraintInterface
{
    validate(type: unknown): boolean {
        return typeof type === "string" && type.startsWith("urn:paso:sca:");
    }

    defaultMessage(): string {
        return "transaction_data type must strictly start with the prefix 'urn:paso:sca:'";
    }
}

export function IsPaSOTransactionType(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsPaSOTransactionTypeConstraint,
        });
    };
}
