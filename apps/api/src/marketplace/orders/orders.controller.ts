import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../../auth/guards/supabase-jwt.guard";
import { RequirePlatformModule } from "../../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../../feature-flags/platform-module-enabled.guard";
import {
  ListOrdersQueryDto,
  OrdersCountersQueryDto
} from "./dto/list-orders-query.dto";
import { OrdersProjectionService } from "./orders-projection.service";

@Controller("marketplace/orders")
@RequirePlatformModule("marketplace")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersProjectionService) {}

  @Get("counters")
  counters(
    @CurrentUser() user: User,
    @Query() query: OrdersCountersQueryDto
  ) {
    return this.orders.counters(user, query.role);
  }

  @Get()
  list(@CurrentUser() user: User, @Query() query: ListOrdersQueryDto) {
    return this.orders.listOrders(user, {
      role: query.role,
      segment: query.segment,
      cursor: query.cursor,
      limit: query.limit
    });
  }
}
