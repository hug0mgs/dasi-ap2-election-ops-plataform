import { Module } from "@nestjs/common";
import { EventBusModule } from "@eops/event-bus";
import { PollingPlaceInspectionsController } from "./polling-place-inspections.controller";
import { PollingPlaceInspectionsService } from "./polling-place-inspections.service";
@Module({
  imports: [EventBusModule],
  controllers: [PollingPlaceInspectionsController],
  providers: [PollingPlaceInspectionsService],
  exports: [PollingPlaceInspectionsService],
})
export class PollingPlaceInspectionsModule {}
