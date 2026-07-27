create table if not exists ods_mobile_action_request (
  request_id varchar(100) primary key,
  username varchar(100) not null,
  workflow varchar(20) not null,
  job_code varchar(100) not null,
  response jsonb,
  created_at timestamp not null default localtimestamp(0),
  completed_at timestamp
);

create index if not exists ods_mobile_action_request_created_idx
  on ods_mobile_action_request(created_at);
