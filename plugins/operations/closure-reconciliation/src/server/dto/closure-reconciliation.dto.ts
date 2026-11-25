import {
  ClosureExceptionRisk,
  ClosureItemCategory,
  ClosureItemStatus,
  ClosureReconciliationStatus,
  ClosureSeverity,
  ClosureSignoffRole,
} from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";

export class ClosureQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsEnum(ClosureReconciliationStatus)
  @IsOptional()
  status?: ClosureReconciliationStatus;
  @IsEnum(ClosureItemCategory) @IsOptional() category?: ClosureItemCategory;
  @IsEnum(ClosureSeverity) @IsOptional() severity?: ClosureSeverity;
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  blocking?: boolean;
  @IsEnum(ClosureItemStatus) @IsOptional() itemStatus?: ClosureItemStatus;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
}

export class ConcurrencyDto {
  @IsDateString() expectedUpdatedAt!: string;
}

export class CreateClosureDto {
  @IsString() electionId!: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @MaxLength(2000) @IsOptional() notes?: string;
}

export class UpdateClosureDto extends ConcurrencyDto {
  @IsString() @MaxLength(2000) @IsOptional() notes?: string;
  @IsString() @MaxLength(2000) @IsOptional() closureReason?: string;
}

export class ResolveItemDto extends ConcurrencyDto {
  @IsString() @Length(5, 2000) resolutionNote!: string;
}

export class DismissItemDto extends ConcurrencyDto {
  @IsString() @Length(5, 2000) reason!: string;
}

export class ReopenItemDto extends ConcurrencyDto {
  @IsString() @Length(5, 2000) reason!: string;
}

export class RegisterExceptionDto extends ConcurrencyDto {
  @IsString() @IsOptional() itemId?: string;
  @IsEnum(ClosureItemCategory) @IsOptional() category?: ClosureItemCategory;
  @IsEnum(ClosureExceptionRisk) risk!: ClosureExceptionRisk;
  @IsString() @Length(20, 4000) justification!: string;
  @IsString() @MaxLength(4000) @IsOptional() mitigation?: string;
  @IsDateString() @IsOptional() validUntil?: string;
}

export class AcceptExceptionDto extends ConcurrencyDto {
  @IsString() @MaxLength(2000) @IsOptional() note?: string;
}

export class RevokeExceptionDto extends ConcurrencyDto {
  @IsString() @Length(5, 2000) reason!: string;
}

export class SignoffDto extends ConcurrencyDto {
  @IsEnum(ClosureSignoffRole) role!: ClosureSignoffRole;
  @IsString() @Length(10, 2000) statement!: string;
}

export class SubmitClosureDto extends ConcurrencyDto {}

export class ApproveClosureDto extends ConcurrencyDto {
  @IsString() @MaxLength(2000) @IsOptional() note?: string;
}

export class CloseClosureDto extends ConcurrencyDto {
  @IsString() @Length(20, 4000) closureReason!: string;
}

export class ReopenClosureDto extends ConcurrencyDto {
  @IsString() @Length(5, 2000) reason!: string;
}

export class CancelClosureDto extends ConcurrencyDto {
  @IsString() @Length(5, 2000) reason!: string;
}
