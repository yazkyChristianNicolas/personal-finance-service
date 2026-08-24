import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { PageQueryDto } from '../common/dto/page-query.dto';

@Controller('groups')
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryDto,
  ) {
    return this.groupsService.findMany(user.userId, query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.userId, dto);
  }

  @Get(':id/members')
  findMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') groupId: string,
  ) {
    return this.groupsService.findMembers(user.userId, groupId);
  }
}
