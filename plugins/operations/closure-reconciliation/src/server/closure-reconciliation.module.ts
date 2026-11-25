import { Module } from "@nestjs/common";
import { EventBusModule } from "@eops/event-bus";
import { ClosureReconciliationController } from "./closure-reconciliation.controller";
import { ClosureReconciliationService } from "./closure-reconciliation.service";

@Module({
  imports: [EventBusModule],
  controllers: [ClosureReconciliationController],
  providers: [ClosureReconciliationService],
  exports: [ClosureReconciliationService],
})
export class ClosureReconciliationModule {}
