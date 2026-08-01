export interface ProjectDocumentMentionUser {
  id: number;
  email: string;
}

export interface ProjectDocumentUserMention {
  id: number;
  email: string;
  label: string;
  link: string;
}

export function projectDocumentMentionUsers(
  query: string,
  users: readonly ProjectDocumentMentionUser[],
): ProjectDocumentUserMention[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return users
    .filter((user) => {
      const email = user.email.trim().toLocaleLowerCase();
      const name = email.split("@")[0] ?? email;
      return (
        !normalizedQuery ||
        email.includes(normalizedQuery) ||
        name.includes(normalizedQuery)
      );
    })
    .map((user) => {
      const email = user.email.trim();
      return {
        id: user.id,
        email,
        label: `@${email}`,
        link: `mailto:${email}`,
      };
    });
}
