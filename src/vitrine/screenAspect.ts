// Web screenshots are wide/landscape-ish; iOS and Android captures are portrait phone
// screens — one fixed 16/10 box (the old default) made every mobile screen look squashed.
export function screenAspectRatio(platform: string): string {
  return platform === 'ios' || platform === 'android' ? '9/19.5' : '16/10';
}
