import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import {
  AcceptRiskDto,
  ApproveDto,
  AssigneeDto,
  ConcurrencyDto,
  CreateInspectionDto,
  DecisionDto,
  EvidenceLinkDto,
  FindingDto,
  InspectionQueryDto,
  ResolveFindingDto,
  ResponseDto,
  ScheduleDto,
  UpdateFindingDto,
  UpdateInspectionDto,
} from "./dto/polling-place-inspections.dto";
import { PollingPlaceInspectionsService } from "./polling-place-inspections.service";
@Permissions(PERMISSIONS.pollingPlaceInspections.read)
@Controller("polling-place-inspections")
export class PollingPlaceInspectionsController {
  constructor(private readonly service: PollingPlaceInspectionsService) {}
  @Get("dashboard") dashboard(@Query() q: InspectionQueryDto) {
    return this.service.dashboard(q);
  }
  @Get("references") references() {
    return this.service.references();
  }
  @Get("catalog") catalog() {
    return this.service.catalog();
  }
  @Get() list(@Query() q: InspectionQueryDto) {
    return this.service.list(q);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.create) @Post() create(
    @Body() d: CreateInspectionDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.create(d, r.user.id);
  }
  @Get(":id/history") history(@Param("id") id: string) {
    return this.service.history(id);
  }
  @Get(":id") get(@Param("id") id: string) {
    return this.service.get(id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.manage) @Patch(":id") update(
    @Param("id") id: string,
    @Body() d: UpdateInspectionDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.update(id, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.manage)
  @Post(":id/assignees")
  assign(
    @Param("id") id: string,
    @Body() d: AssigneeDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.assign(id, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.manage)
  @Delete(":id/assignees/:assignmentId")
  unassign(
    @Param("id") id: string,
    @Param("assignmentId") aid: string,
    @Query() d: ConcurrencyDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.unassign(id, aid, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.manage)
  @Post(":id/schedule")
  schedule(
    @Param("id") id: string,
    @Body() d: ScheduleDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.schedule(id, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.execute)
  @Post(":id/start")
  start(
    @Param("id") id: string,
    @Body() d: ConcurrencyDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.start(id, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.execute)
  @Put(":id/responses/:responseId")
  response(
    @Param("id") id: string,
    @Param("responseId") rid: string,
    @Body() d: ResponseDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.response(id, rid, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.execute)
  @Post(":id/findings")
  finding(
    @Param("id") id: string,
    @Body() d: FindingDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.finding(id, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.execute)
  @Patch(":id/findings/:findingId")
  updateFinding(
    @Param("id") id: string,
    @Param("findingId") fid: string,
    @Body() d: UpdateFindingDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.updateFinding(id, fid, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.execute)
  @Post(":id/findings/:findingId/resolve")
  resolve(
    @Param("id") id: string,
    @Param("findingId") fid: string,
    @Body() d: ResolveFindingDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.resolve(id, fid, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.acceptRisk)
  @Post(":id/findings/:findingId/accept-risk")
  accept(
    @Param("id") id: string,
    @Param("findingId") fid: string,
    @Body() d: AcceptRiskDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.acceptRisk(id, fid, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.execute)
  @Put(":id/evidence-links")
  evidence(
    @Param("id") id: string,
    @Body() d: EvidenceLinkDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.evidence(id, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.execute)
  @Post(":id/submit")
  submit(
    @Param("id") id: string,
    @Body() d: ConcurrencyDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.submit(id, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.review)
  @Post(":id/approve")
  approve(
    @Param("id") id: string,
    @Body() d: ApproveDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.approve(id, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.review)
  @Post(":id/request-changes")
  changes(
    @Param("id") id: string,
    @Body() d: DecisionDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.requestChanges(id, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.manage)
  @Post(":id/reopen")
  reopen(
    @Param("id") id: string,
    @Body() d: DecisionDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.reopen(id, d, r.user.id);
  }
  @Permissions(PERMISSIONS.pollingPlaceInspections.manage)
  @Post(":id/cancel")
  cancel(
    @Param("id") id: string,
    @Body() d: DecisionDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, d, r.user.id);
  }
}
