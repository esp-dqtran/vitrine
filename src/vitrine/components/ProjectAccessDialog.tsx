import { Spinner } from './Spinner.tsx';
import { useEffect, useState } from "react";
import {
  Button,
  Heading,
  Icon,
  IconButton,
  Selector,
  Text,
  TextInput,
} from "@astryxdesign/core";

import type {
  ResearchProjectMemberRole,
  ResearchProjectMembersView,
} from "../../researchProject.ts";
import {
  addResearchProjectMember,
  listResearchProjectMembers,
  removeResearchProjectMember,
} from "../researchProjectsApi.ts";
import { AstryxModal } from "./AstryxModal.tsx";

export interface ProjectAccessTarget {
  id: string;
  title: string;
}

export function ProjectAccessDialog({
  project,
  isOpen,
  onOpenChange,
}: {
  project: ProjectAccessTarget | null;
  isOpen: boolean;
  onOpenChange(open: boolean): void;
}) {
  const [view, setView] = useState<ResearchProjectMembersView>();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ResearchProjectMemberRole>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !project) return;
    let active = true;
    setView(undefined);
    setError("");
    void listResearchProjectMembers(project.id)
      .then((next) => { if (active) setView(next); })
      .catch((cause) => { if (active) setError((cause as Error).message); });
    return () => { active = false; };
  }, [isOpen, project]);

  const invite = async () => {
    if (!project || !email.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      setView(await addResearchProjectMember(project.id, email.trim(), role));
      setEmail("");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: number) => {
    if (!project || busy) return;
    setBusy(true);
    setError("");
    try {
      await removeResearchProjectMember(project.id, userId);
      setView(await listResearchProjectMembers(project.id));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AstryxModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      purpose="form"
      width={520}
    >
      <div className="project-access-dialog">
        <div className="project-access-dialog__header">
          <div>
            <Heading level={3}>Share {project?.title ?? "project"}</Heading>
            <Text color="secondary">
              {view?.organization
                ? `Everyone in ${view.organization.name} can edit by default. Direct roles can grant guest access or make a Team member view-only.`
                : "Invite people directly as editors or viewers."}
            </Text>
          </div>
          <IconButton
            label="Close sharing"
            icon={<Icon icon="close" size="sm" />}
            variant="ghost"
            size="sm"
            className="astryx-modal__icon-action project-access-dialog__close"
            onClick={() => onOpenChange(false)}
          />
        </div>

        {!view && !error ? <div className="project-access-dialog__loading"><Spinner size="md" /></div> : null}
        {error ? <p role="alert" className="projects-workspace__error">{error}</p> : null}

        {view?.canManage ? (
          <form
            className="project-access-dialog__invite"
            onSubmit={(event) => { event.preventDefault(); void invite(); }}
          >
            <TextInput
              label="Email"
              placeholder="teammate@example.com"
              value={email}
              onChange={setEmail}
              width="100%"
              isDisabled={busy}
            />
            <Selector
              label="Role"
              value={role}
              onChange={(value) => setRole(value as ResearchProjectMemberRole)}
              options={[
                { value: "editor", label: "Editor" },
                { value: "viewer", label: "Viewer" },
              ]}
              width="100%"
              isDisabled={busy}
            />
            <Button
              label="Add person"
              variant="primary"
              isDisabled={!email.trim()}
              isLoading={busy}
              clickAction={invite}
              className="project-access-dialog__add-person"
            />
          </form>
        ) : view ? (
          <Text color="secondary">Only the Project owner or a Team owner/admin can change access.</Text>
        ) : null}

        {view ? (
          <section className="project-access-dialog__members" aria-label="Direct project members">
            <div className="project-access-dialog__members-heading">
              <strong>Direct access</strong>
              <span>{view.members.length}</span>
            </div>
            {view.members.length ? view.members.map((member) => (
              <div className="project-access-dialog__member" key={member.userId}>
                <span className="project-access-dialog__avatar" aria-hidden="true">
                  {member.email.charAt(0).toUpperCase()}
                </span>
                <span className="project-access-dialog__member-email">{member.email}</span>
                <span className="project-access-dialog__role">{member.role}</span>
                {view.canManage ? (
                  <Button
                    label="Remove"
                    variant="ghost"
                    size="sm"
                    isDisabled={busy}
                    clickAction={() => void remove(member.userId)}
                  />
                ) : null}
              </div>
            )) : (
              <Text color="secondary" className="project-access-dialog__empty-state">
                No one has direct access yet. Only people invited here can access this canvas.
              </Text>
            )}
          </section>
        ) : null}

        <div className="projects-workspace__dialog-actions">
          <Button label="Done" variant="secondary" clickAction={() => onOpenChange(false)} />
        </div>
      </div>
    </AstryxModal>
  );
}

export function ProjectAccessButton({
  project,
  label = "Share",
  emphasized = false,
}: {
  project: ProjectAccessTarget;
  label?: string;
  emphasized?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        label={label}
        variant={emphasized ? "primary" : "ghost"}
        size="sm"
        clickAction={() => setOpen(true)}
      />
      <ProjectAccessDialog project={project} isOpen={open} onOpenChange={setOpen} />
    </>
  );
}
