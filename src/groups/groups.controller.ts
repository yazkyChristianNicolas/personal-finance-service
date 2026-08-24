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
  search(@CurrentUser() user: AuthenticatedUser, @Query() query: PageQueryDto) {
    return this.groupsService.search(user.userId, query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.userId, dto);
  }

  @Get(':id/members')
  searchMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') groupId: string,
    @Query() query: PageQueryDto,
  ) {
    return this.groupsService.searchMembers(user.userId, groupId, query);
  }
}
