-- ═══════════════════════════════════════════════════════════════
-- ระบบพระโอวาท ver2 — โครงสร้างฐานข้อมูล
--
-- หลักการออกแบบ:
--   1. เนื้อหาพระโอวาทเป็นของศักดิ์สิทธิ์ — เก็บต้นฉบับไว้ครบ ไม่แก้
--      (การล้างข้อมูลทำที่ metadata เท่านั้น ไม่แตะ content)
--   2. ท่อนที่ใช้ค้น/สุ่ม แตกเก็บไว้ล่วงหน้า ไม่แตกใหม่ทุกครั้งที่เรียก
--   3. ชื่อองค์/สถานธรรม/ชั้นเรียน แยกเป็นตารางอ้างอิง กันสะกดต่างกัน
--   4. กติกาสำคัญบังคับที่ฐานข้อมูล ไม่ใช่ฝั่งหน้าเว็บ
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;      -- ค้นหาข้อความไทยแบบคลุมเครือ

-- ── ตารางอ้างอิง ────────────────────────────────────────────────
-- เดิมเก็บเป็นข้อความดิบ ทำให้ "จ.โคราช" กับ "จ.นครราชสีมา" กลายเป็นคนละค่า

create table deities (                        -- องค์ผู้ประทาน
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,           -- ชื่อที่ใช้แสดง
  aliases     text[] default '{}',            -- ชื่อเรียกอื่นที่หมายถึงองค์เดียวกัน
  created_at  timestamptz not null default now()
);

create table temples (                        -- สถานธรรม
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  province    text,
  country     text not null default 'ไทย',
  aliases     text[] default '{}',
  created_at  timestamptz not null default now(),
  unique (name, province)
);

create table categories (                     -- ชั้นเรียน / ประเภทวาระ
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- ── พระโอวาท ────────────────────────────────────────────────────

create type teaching_status as enum ('draft', 'published', 'archived');

create table teachings (
  id            uuid primary key default uuid_generate_v4(),
  legacy_id     text unique,                  -- id เดิมจาก ver1 (ใช้อ้างอิงย้อนกลับ)

  content       text not null,                -- เนื้อหาต้นฉบับ ห้ามแก้
  content_hash  text not null,                -- sha256 ของเนื้อหาต้นฉบับ (ตรวจว่าถูกแก้ไหม)
  dedupe_hash   text not null,                -- sha256 ของเนื้อหาหลังตัดช่องว่าง/รูปแบบ — ใช้จับฉบับซ้ำ

  -- ฉบับที่เนื้อหาซ้ำกับฉบับอื่น: ไม่ลบทิ้ง แต่ชี้ว่าซ้ำกับฉบับไหน
  -- (เนื้อหาศักดิ์สิทธิ์ — เก็บไว้ครบ ให้ผู้ดูแลตัดสินใจเอง)
  duplicate_of  uuid references teachings(id) on delete set null,

  deity_id      uuid references deities(id) on delete set null,
  temple_id     uuid references temples(id) on delete set null,
  category_id   uuid references categories(id) on delete set null,

  taught_on     date,                         -- วันที่ประทาน (null = ไม่ระบุ)
  location_note text,                         -- ข้อความสถานที่ดิบ เผื่อจับคู่ temple ไม่ได้

  status        teaching_status not null default 'published',
  source_file   text,                         -- ไฟล์ต้นฉบับที่นำเข้ามา
  imported_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint teachings_content_not_empty check (length(trim(content)) > 0)
);

-- ไม่บังคับ unique เพื่อให้ย้ายข้อมูลเข้าได้ครบทุกฉบับ ไม่มีอะไรหาย
-- ฉบับซ้ำถูกทำเครื่องหมายด้วย duplicate_of แทน แล้วกรองออกตอนแสดงผล
create index teachings_dedupe_hash_idx on teachings (dedupe_hash);
create index teachings_duplicate_idx   on teachings (duplicate_of);
create index teachings_taught_on_idx  on teachings (taught_on desc nulls last);
create index teachings_deity_idx      on teachings (deity_id);
create index teachings_temple_idx     on teachings (temple_id);
create index teachings_category_idx   on teachings (category_id);
create index teachings_status_idx     on teachings (status);

-- ── ท่อนพระโอวาท (แตกไว้ล่วงหน้า) ───────────────────────────────
-- ver1 แตก 44,915 ท่อนใหม่ทุกครั้งที่เซิร์ฟเวอร์ตื่น (ใช้เวลา 383ms + แรม 64MB)

create table teaching_passages (
  id            uuid primary key default uuid_generate_v4(),
  teaching_id   uuid not null references teachings(id) on delete cascade,
  idx           int  not null,                -- ลำดับท่อนในฉบับ
  text          text not null,                -- ข้อความท่อน (ตรงต้นฉบับ)
  display_key   text not null,                -- ข้อความหลังล้างรูปแบบ — ใช้รวมท่อนที่ผู้ใช้เห็นว่าซ้ำ
  char_length   int  not null,
  is_quotable   boolean not null default true,-- ยกมาแสดงเดี่ยวๆ ได้ไหม (40–300 ตัวอักษร)
  created_at    timestamptz not null default now(),
  unique (teaching_id, idx)
);

create index passages_teaching_idx  on teaching_passages (teaching_id);
create index passages_quotable_idx  on teaching_passages (is_quotable) where is_quotable;
create index passages_display_key   on teaching_passages (display_key);
-- ค้นหาข้อความไทยแบบ substring (ภาษาไทยไม่มีช่องว่างระหว่างคำ full-text ปกติจึงใช้ไม่ได้ดี)
create index passages_text_trgm on teaching_passages using gin (text gin_trgm_ops);

-- ── สมาชิก ──────────────────────────────────────────────────────

create type member_status as enum ('pending', 'active', 'rejected', 'blocked');
create type member_role   as enum ('member', 'admin');

create table members (
  id             uuid primary key default uuid_generate_v4(),
  email          text not null unique,
  password_hash  text not null,               -- bcrypt (ver1 ใช้ sha256 ไม่มี salt)
  name           text not null,
  dharma_title   text,                        -- ตำแหน่งทางธรรม
  temple_name    text,                        -- สถานธรรมที่สังกัด
  status         member_status not null default 'pending',
  role           member_role   not null default 'member',
  reviewed_by    uuid references members(id) on delete set null,
  reviewed_at    timestamptz,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index members_status_idx on members (status);
create index members_email_idx  on members (lower(email));

-- ── การสุ่มพระโอวาทประจำวัน ─────────────────────────────────────
-- ver1 จำกัดด้วย localStorage ฝั่งเบราว์เซอร์ — ล้างข้อมูลหรือเปลี่ยนเครื่องก็สุ่มใหม่ได้
-- ย้ายมาบังคับที่ฐานข้อมูลแทน

create table daily_draws (
  id           uuid primary key default uuid_generate_v4(),
  member_id    uuid references members(id) on delete cascade,
  guest_key    text,                          -- สำหรับผู้ที่ยังไม่เข้าสู่ระบบ
  draw_date    date not null,
  passage_id   uuid not null references teaching_passages(id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint draws_owner_present check (member_id is not null or guest_key is not null)
);

-- หนึ่งคน หนึ่งครั้ง ต่อวัน — บังคับที่ฐานข้อมูล
create unique index draws_member_per_day on daily_draws (member_id, draw_date) where member_id is not null;
create unique index draws_guest_per_day  on daily_draws (guest_key, draw_date) where guest_key is not null;
create index draws_date_idx on daily_draws (draw_date desc);

-- ── มุมมองสำหรับใช้งานทั่วไป ────────────────────────────────────
-- กรองฉบับซ้ำออกให้อัตโนมัติ — ฉบับต้นฉบับยังอยู่ครบในตารางจริง

create view teachings_active as
  select * from teachings
  where duplicate_of is null and status = 'published';

-- ── อัปเดต updated_at อัตโนมัติ ─────────────────────────────────

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger teachings_touch before update on teachings
  for each row execute function touch_updated_at();
create trigger members_touch   before update on members
  for each row execute function touch_updated_at();

-- ── ความปลอดภัย ────────────────────────────────────────────────
-- เปิด RLS ทุกตารางโดยไม่สร้าง policy = ปฏิเสธทั้งหมดสำหรับคีย์สาธารณะ
-- แอปเข้าถึงผ่าน service role ฝั่งเซิร์ฟเวอร์เท่านั้น
-- (บทเรียนจากระบบเก่า: anon key ฝังอยู่ในหน้าเว็บ ใครก็ดึงข้อมูลตรงได้)

alter table deities           enable row level security;
alter table temples           enable row level security;
alter table categories        enable row level security;
alter table teachings         enable row level security;
alter table teaching_passages enable row level security;
alter table members           enable row level security;
alter table daily_draws       enable row level security;
