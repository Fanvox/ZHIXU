-- ============================================================
-- 知序 Zhixu — 可选：pgvector 向量检索
-- 在启用向量检索时执行本迁移（需先安装 pgvector 扩展）。
-- 本地开发使用关键词检索，部署后可用此实现语义检索。
-- ============================================================

create extension if not exists vector;

-- 为文档分块增加向量列（维度与所选 embedding 模型一致，此处以 1536 为例）
alter table public.document_chunks
  add column if not exists embedding vector(1536);

-- HNSW 索引加速近似最近邻检索
create index if not exists idx_chunks_embedding
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- 相似度检索函数：按余弦相似度返回最相关的分块
create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_course uuid,
  match_count int default 4
)
returns table (
  id uuid,
  content text,
  document_id uuid,
  page_start int,
  similarity float
)
language sql stable as $$
  select
    dc.id,
    dc.content,
    dc.document_id,
    dc.page_start,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where d.course_id = match_course
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
