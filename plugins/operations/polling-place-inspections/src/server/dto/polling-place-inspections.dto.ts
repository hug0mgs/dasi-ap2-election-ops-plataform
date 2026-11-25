import {
  PollingPlaceInspectionAnswer,
  PollingPlaceInspectionAssigneeRole,
  PollingPlaceInspectionDimension,
  PollingPlaceInspectionEvidenceTarget,
  PollingPlaceInspectionFitness,
  PollingPlaceInspectionFindingStatus,
  PollingPlaceInspectionSeverity,
  PollingPlaceInspectionStatus,
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
export class InspectionQueryDto {
  @IsString() @IsOptional() electionId?: string;
  @IsString() @IsOptional() electoralZoneId?: string;
  @IsString() @IsOptional() pollingPlaceId?: string;
  @IsString() @IsOptional() assigneeId?: string;
  @IsEnum(PollingPlaceInspectionStatus)
  @IsOptional()
  status?: PollingPlaceInspectionStatus;
  @IsEnum(PollingPlaceInspectionFitness)
  @IsOptional()
  fitness?: PollingPlaceInspectionFitness;
  @IsEnum(PollingPlaceInspectionDimension)
  @IsOptional()
  problemDimension?: PollingPlaceInspectionDimension;
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  openBlocking?: boolean;
  @IsDateString() @IsOptional() from?: string;
  @IsDateString() @IsOptional() to?: string;
}
export class ConcurrencyDto {
  @IsDateString() expectedUpdatedAt!: string;
}
export class CreateInspectionDto {
  @IsString() electionId!: string;
  @IsString() electoralZoneId!: string;
  @IsString() pollingPlaceId!: string;
  @IsString() templateId!: string;
  @IsString() @Length(2, 80) inspectionType!: string;
  @IsString() @IsOptional() previousInspectionId?: string;
}
export class UpdateInspectionDto extends ConcurrencyDto {
  @IsString() @MaxLength(3000) @IsOptional() accessNotes?: string;
  @IsString() @MaxLength(300) @IsOptional() localContact?: string;
}
export class AssigneeDto extends ConcurrencyDto {
  @IsString() userId!: string;
  @IsEnum(PollingPlaceInspectionAssigneeRole)
  role!: PollingPlaceInspectionAssigneeRole;
}
export class ScheduleDto extends ConcurrencyDto {
  @IsDateString() plannedAt!: string;
}
export class ResponseDto extends ConcurrencyDto {
  @IsEnum(PollingPlaceInspectionAnswer) answer!: PollingPlaceInspectionAnswer;
  @IsString() @MaxLength(3000) @IsOptional() observation?: string;
  @IsString() @MaxLength(3000) @IsOptional() justification?: string;
}
export class FindingDto extends ConcurrencyDto {
  @IsString() @Length(2, 200) title!: string;
  @IsString() @Length(2, 5000) description!: string;
  @IsEnum(PollingPlaceInspectionDimension)
  dimension!: PollingPlaceInspectionDimension;
  @IsEnum(PollingPlaceInspectionSeverity)
  severity!: PollingPlaceInspectionSeverity;
  @IsString() @IsOptional() responseId?: string;
  @IsString() @MaxLength(500) @IsOptional() location?: string;
  @IsString() @MaxLength(3000) @IsOptional() recommendation?: string;
  @IsString() @IsOptional() responsibleId?: string;
  @IsString() @MaxLength(200) @IsOptional() responsibleName?: string;
  @IsDateString() @IsOptional() dueAt?: string;
  @IsBoolean() @IsOptional() blocking?: boolean;
  @IsString() @MaxLength(2000) @IsOptional() blockingReason?: string;
}
export class UpdateFindingDto extends ConcurrencyDto {
  @IsEnum(PollingPlaceInspectionFindingStatus)
  @IsOptional()
  status?: PollingPlaceInspectionFindingStatus;
  @IsString() @MaxLength(3000) @IsOptional() recommendation?: string;
  @IsString() @IsOptional() responsibleId?: string;
  @IsDateString() @IsOptional() dueAt?: string;
}
export class ResolveFindingDto extends ConcurrencyDto {
  @IsString() @Length(2, 5000) resolution!: string;
}
export class AcceptRiskDto extends ConcurrencyDto {
  @IsString() @Length(2, 5000) reason!: string;
  @IsDateString() validUntil!: string;
}
export class EvidenceLinkDto extends ConcurrencyDto {
  @IsString() evidenceId!: string;
  @IsEnum(PollingPlaceInspectionEvidenceTarget)
  targetType!: PollingPlaceInspectionEvidenceTarget;
  @IsString() targetId!: string;
  @IsBoolean() @IsOptional() remove?: boolean;
}
export class DecisionDto extends ConcurrencyDto {
  @IsString() @Length(2, 5000) reason!: string;
}
export class ApproveDto extends ConcurrencyDto {
  @IsEnum(PollingPlaceInspectionFitness)
  fitness!: PollingPlaceInspectionFitness;
  @IsString() @MaxLength(5000) @IsOptional() reason?: string;
}
