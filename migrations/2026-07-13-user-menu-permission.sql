-- ສິດລາຍຜູ້ໃຊ້ຕໍ່ເມນູ. ບໍ່ມີແຖວ = ສືບທອດສິດຈາກ role ເກົ່າ.
create table if not exists ods_user_menu_permission (
  employee_code varchar(32) not null,
  resource varchar(120) not null,
  can_read boolean not null default false,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  updated_by varchar(100) not null,
  updated_at timestamp without time zone not null default localtimestamp(0),
  constraint ods_user_menu_permission_pk primary key (employee_code, resource),
  constraint ods_user_menu_permission_resource_ck check (resource like '/%'),
  constraint ods_user_menu_permission_read_ck check (
    can_read or not (can_create or can_update or can_delete)
  )
);

create index if not exists ods_user_menu_permission_resource_idx
  on ods_user_menu_permission (resource);

comment on table ods_user_menu_permission is
  'Per-employee menu CRUD overrides. Missing row inherits legacy role permissions.';
