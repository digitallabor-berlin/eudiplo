import { ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsOptional, ValidateNested } from "class-validator";
import { PresentationConfig } from "../entities/presentation-config.entity";
import { TransactionDataDTO } from "../dto/transaction-data.dto";

export class PresentationConfigCreateDto extends OmitType(PresentationConfig, [
    "tenantId",
    "tenant",
    "createdAt",
    "updatedAt",
] as const) {
    @ApiPropertyOptional({ type: [TransactionDataDTO] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TransactionDataDTO)
    transaction_data?: TransactionDataDTO[];
}
