export interface Tag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagListItem extends Tag {
  usageCount: number;
}

export interface TagsSnapshot {
  tags: TagListItem[];
}

export interface CreateTagInput {
  name: string;
}

export interface UpdateTagInput extends CreateTagInput {
  id: string;
}
