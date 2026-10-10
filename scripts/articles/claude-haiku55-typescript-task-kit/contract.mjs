export const PROMPT = "Complete the TypeScript maintenance task in SPEC.md. Follow its public specification and change only its permitted files. Use only Read, Edit and Write tools within this task directory. Bash and other shell tools are unavailable: do not request shell commands or execute tests. The host will run the public checks and independent grading after you finish. Use no network, external service, dependency installation, secret, browser, subagent, or files outside this task directory. Report completion briefly.";
export const MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5'];
export const TRIAL_SECONDS = 240;
export const TURNS = 16;
export const VERSION = '2.1.295';
export const ORDER = [0,1,1,0,0,1];
export const MARKER = 'CONCLUSIVE_EVIDENCE_CAPTURED';
