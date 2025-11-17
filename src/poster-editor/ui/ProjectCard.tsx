import React from 'react';
import { Button } from '@/components/ui/button';
import { Project } from '../cloud/projectsApi';

type Props = {
  project: Project;
  onOpen: (p: Project) => void;
  onDelete: (p: Project) => void;
  onDuplicate: (p: Project) => void;
  onRename: (p: Project) => void;
};

const ProjectCard: React.FC<Props> = ({ project, onOpen, onDelete, onDuplicate, onRename }) => {
  return (
    <div className="rounded-lg border p-3 flex gap-3 items-center">
      <img src={project.preview_url ?? '/placeholder.svg'} alt={project.name} className="w-24 h-16 object-cover rounded" />
      <div className="flex-1">
        <div className="text-sm font-medium">{project.name}</div>
        <div className="text-xs text-muted-foreground">Updated {new Date(project.updated_at).toLocaleString()}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={()=>onOpen(project)}>Open</Button>
        <Button variant="outline" onClick={()=>onRename(project)}>Rename</Button>
        <Button variant="outline" onClick={()=>onDuplicate(project)}>Duplicate</Button>
        <Button variant="destructive" onClick={()=>onDelete(project)}>Delete</Button>
      </div>
    </div>
  );
};

export default ProjectCard;