import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { PERMISSIONS, Permissions, type AuthenticatedRequest } from "@eops/security";
import { ReportQueryDto } from "./dto/report-query.dto";
import { IncidentsReportQueryDto } from "./dto/incidents-report-query.dto";
import {
  CreateReportViewDto,
  DrilldownQueryDto,
  ExportJsonQueryDto,
  ExportReportQueryDto,
  SlaQueryDto,
  TimeseriesQueryDto,
  UpdateReportViewDto,
  ZonesQueryDto,
} from "./dto/analytics.dto";
import { ReportsService } from "./reports.service";
import { ReportsViewsService } from "./reports-views.service";

@Permissions(PERMISSIONS.reports.read)
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly views: ReportsViewsService,
  ) {}

  @Get("executive") executive(@Query() query: ReportQueryDto) { return this.service.executive(query); }
  @Get("operations") operations(@Query() query: ReportQueryDto) { return this.service.operations(query); }
  @Get("incidents") incidents(@Query() query: IncidentsReportQueryDto) { return this.service.incidents(query); }
  @Get("transmission") transmission(@Query() query: ReportQueryDto) { return this.service.transmission(query); }
  @Get("workforce") workforce(@Query() query: ReportQueryDto) { return this.service.workforce(query); }
  @Get("logistics") logistics(@Query() query: ReportQueryDto) { return this.service.logistics(query); }
  @Get("assets") assets(@Query() query: ReportQueryDto) { return this.service.assets(query); }
  @Get("timeseries") timeseries(@Query() query: TimeseriesQueryDto) { return this.service.timeseries(query); }
  @Get("sla") sla(@Query() query: SlaQueryDto) { return this.service.sla(query); }
  @Get("zones") zones(@Query() query: ZonesQueryDto) { return this.service.zoneComparison(query); }
  @Get("drilldown") drilldown(@Query() query: DrilldownQueryDto) { return this.service.drilldown(query); }

  @Get("views") listViews(@Req() request: AuthenticatedRequest) { return this.views.list(request.user.id, request.user.permissions); }
  @Post("views") createView(@Body() dto: CreateReportViewDto, @Req() request: AuthenticatedRequest) { return this.views.create(dto, request.user.id, request.user.permissions); }
  @Patch("views/:id") updateView(@Param("id") id: string, @Body() dto: UpdateReportViewDto, @Req() request: AuthenticatedRequest) { return this.views.update(id, dto, request.user.id, request.user.permissions); }
  @Delete("views/:id") removeView(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.views.remove(id, request.user.id, request.user.permissions); }

  @Permissions(PERMISSIONS.reports.read, PERMISSIONS.reports.export) @Get("export.csv") async csv(@Query() query: ExportReportQueryDto, @Req() request: AuthenticatedRequest, @Res() response: Response) { const resolved = await this.resolveExport(query, request.user.id); const content = await this.service.csv(resolved.query, resolved.view); response.setHeader("Content-Type", "text/csv; charset=utf-8"); response.setHeader("Content-Disposition", `attachment; filename=${resolved.filename}.csv`); response.send(`${content}`); }
  @Permissions(PERMISSIONS.reports.read, PERMISSIONS.reports.export) @Get("export.pdf") async pdf(@Query() query: ExportReportQueryDto, @Req() request: AuthenticatedRequest, @Res() response: Response) { const resolved = await this.resolveExport(query, request.user.id); const content = await this.service.pdf(resolved.query, resolved.view); response.setHeader("Content-Type", "application/pdf"); response.setHeader("Content-Disposition", `attachment; filename=${resolved.filename}.pdf`); response.send(content); }
  @Permissions(PERMISSIONS.reports.export) @Get("export.json") exportJson(@Query() query: ExportJsonQueryDto) { return this.service.exportJson(query); }

  private async resolveExport(query: ExportReportQueryDto, actorId: string) {
    if (!query.viewId)
      return { query, filename: "relatorio-election-ops", view: undefined };
    const saved = await this.views.resolveForExport(query.viewId, actorId);
    const filters = saved.filters as Record<string, unknown>;
    const reportQuery: ReportQueryDto = {
      from: this.stringFilter(filters.from),
      to: this.stringFilter(filters.to),
      electionId: this.stringFilter(filters.electionId),
      zoneId: this.stringFilter(filters.electoralZoneId),
      pollingPlaceId: this.stringFilter(filters.pollingPlaceId),
      categoryId: this.stringFilter(filters.categoryId),
      status: this.stringFilter(filters.status),
      severity: this.stringFilter(filters.severity),
    };
    const metrics = Array.isArray(saved.metricsJson)
      ? saved.metricsJson.filter((metric): metric is string => typeof metric === "string")
      : [];
    return {
      query: reportQuery,
      filename: this.exportFilename(saved.name),
      view: {
        name: saved.name,
        ownerName: saved.owner?.name ?? saved.ownerId,
        shared: saved.shared,
        metrics,
        granularity: saved.granularity,
      },
    };
  }

  private stringFilter(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private exportFilename(name: string) {
    const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    return slug ? `relatorio-${slug}` : "relatorio-election-ops";
  }
}
