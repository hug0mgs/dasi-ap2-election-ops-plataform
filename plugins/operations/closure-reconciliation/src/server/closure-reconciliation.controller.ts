import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "@eops/security";
import { PERMISSIONS, Permissions } from "@eops/security";
import {
  AcceptExceptionDto,
  ApproveClosureDto,
  CancelClosureDto,
  CloseClosureDto,
  ClosureQueryDto,
  ConcurrencyDto,
  CreateClosureDto,
  DismissItemDto,
  RegisterExceptionDto,
  ReopenClosureDto,
  ReopenItemDto,
  ResolveItemDto,
  RevokeExceptionDto,
  SignoffDto,
  SubmitClosureDto,
  UpdateClosureDto,
} from "./dto/closure-reconciliation.dto";
import { ClosureReconciliationService } from "./closure-reconciliation.service";

@Permissions(PERMISSIONS.closureReconciliation.read)
@Controller("closure-reconciliation")
export class ClosureReconciliationController {
  constructor(
    private readonly service: ClosureReconciliationService,
  ) {}

  @Get("dashboard")
  dashboard(@Query() q: ClosureQueryDto) {
    return this.service.dashboard(q);
  }

  @Get("references")
  references() {
    return this.service.references();
  }

  @Get("rules")
  rules() {
    return this.service.rules();
  }

  @Get()
  list(@Query() q: ClosureQueryDto) {
    return this.service.list(q);
  }

  @Get(":id/history")
  history(@Param("id") id: string) {
    return this.service.history(id);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.create)
  @Post()
  create(@Body() d: CreateClosureDto, @Req() r: AuthenticatedRequest) {
    return this.service.create(d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.manage)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() d: UpdateClosureDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.update(id, d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.refresh)
  @Post(":id/refresh")
  refresh(
    @Param("id") id: string,
    @Body() d: ConcurrencyDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.refresh(id, d.expectedUpdatedAt, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.manage)
  @Post(":id/items/:itemId/resolve")
  resolve(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() d: ResolveItemDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.resolveItem(id, itemId, d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.manage)
  @Post(":id/items/:itemId/dismiss")
  dismiss(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() d: DismissItemDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.dismissItem(id, itemId, d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.manage)
  @Post(":id/items/:itemId/reopen")
  reopenItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() d: ReopenItemDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.reopenItem(id, itemId, d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.exceptions)
  @Post(":id/exceptions")
  registerException(
    @Param("id") id: string,
    @Body() d: RegisterExceptionDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.registerException(id, d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.approve)
  @Post(":id/exceptions/:exceptionId/accept")
  acceptException(
    @Param("id") id: string,
    @Param("exceptionId") exceptionId: string,
    @Body() d: AcceptExceptionDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.acceptException(id, exceptionId, d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.exceptions)
  @Post(":id/exceptions/:exceptionId/revoke")
  revokeException(
    @Param("id") id: string,
    @Param("exceptionId") exceptionId: string,
    @Body() d: RevokeExceptionDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.revokeException(id, exceptionId, d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.manage)
  @Post(":id/signoffs")
  signoff(
    @Param("id") id: string,
    @Body() d: SignoffDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.signoff(id, d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.manage)
  @Delete(":id/signoffs/:signoffId")
  removeSignoff(
    @Param("id") id: string,
    @Param("signoffId") signoffId: string,
    @Query() d: ConcurrencyDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.removeSignoff(
      id,
      signoffId,
      d.expectedUpdatedAt,
      r.user.id,
    );
  }

  @Permissions(PERMISSIONS.closureReconciliation.manage)
  @Post(":id/submit")
  submit(
    @Param("id") id: string,
    @Body() d: SubmitClosureDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.submit(id, d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.approve)
  @Post(":id/approve")
  approve(
    @Param("id") id: string,
    @Body() d: ApproveClosureDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.approve(
      id,
      d.expectedUpdatedAt,
      r.user.id,
      d.note,
    );
  }

  @Permissions(PERMISSIONS.closureReconciliation.close)
  @Post(":id/close")
  close(
    @Param("id") id: string,
    @Body() d: CloseClosureDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.close(id, d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.manage)
  @Post(":id/reopen")
  reopen(
    @Param("id") id: string,
    @Body() d: ReopenClosureDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.reopen(id, d, r.user.id);
  }

  @Permissions(PERMISSIONS.closureReconciliation.manage)
  @Post(":id/cancel")
  cancel(
    @Param("id") id: string,
    @Body() d: CancelClosureDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, d, r.user.id);
  }
}
