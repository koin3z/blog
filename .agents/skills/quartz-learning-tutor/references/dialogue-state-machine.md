# Dialogue state machine

Use the user's latest intent and the evidence already gathered to choose one active state. Do not
force every request through every state.

## States

| State          | Entry condition                                                                                                    | Required action                                                               | Exit                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Explain        | The user asks about a concept, paragraph, difference, or failure                                                   | Explain position, necessity, and cause → constraint → result                  | Ask one Paraphrase question for an important concept, or stop if the turn is file-only |
| Paraphrase     | Explain has established the central model, or the user asks for a review question                                  | Ask one open causal question and wait without giving its answer               | User response → Assess                                                                 |
| Assess         | The user supplies their own explanation or answers a review question                                               | Apply the rubric and correct only the relevant gap                            | Accurate → Consolidate or stop; partial/wrong → focused Explain, then one Paraphrase   |
| Consolidate    | Understanding is confirmed or the user asks what should remain in the note                                         | Classify durable content and present the affected sections and rewrite intent | Explicit update instruction → Apply; otherwise wait                                    |
| Apply          | The user explicitly requests reflection/update/reorganization, or explicitly enabled auto-apply after confirmation | Rewrite the existing note, update `modified`, validate, and report            | Stop after handoff; do not add a tutoring question                                     |
| Publish review | The user explicitly requests publication preparation/review                                                        | Run the publication checklist and build without changing publication state    | Explicit publication approval → change state and rebuild; otherwise stop               |

## Transition rules

- Enter Assess directly when the user says `私の理解では…` or otherwise supplies a paraphrase.
- Enter Apply directly only when the current or preceding dialogue contains technically confirmed
  material and the user has authorized an edit.
- If an Apply request lacks a confirmed user paraphrase, incorporate verified facts and clearly
  labeled models, but do not invent `ユーザーの理解`. Ask for a paraphrase only if recording the
  user's understanding is necessary to fulfill the request.
- Treat `今確認した内容を反映して` as authorization to apply the already confirmed content in the
  current conversation. Do not request the same authorization again.
- When the user explicitly enables auto-apply, confirm its scope. Apply after later accurate
  assessments within that scope; do not let it authorize publication-state changes.
- Let the user redirect the topic from any state. Read any newly relevant section before answering.
- Keep one paraphrase question per turn. A question may test one causal chain containing several
  linked steps, but must not bundle independent concepts.
- After asking a Paraphrase question, end the turn. Do not add hints, an answer, or a second
  question.
- Do not interrupt unrelated research, validation, content maintenance, or file-only work with a
  comprehension question.

## Good paraphrase shape

Ask for an explanation that reveals at least one causal link or boundary:

- why an extra mechanism is needed under a stated threat or constraint
- where two similar mechanisms sit in a request or data path
- how a state transition causes the next observable result
- when a mechanism applies and when it does not

Avoid `分かりましたか`, `もう一度説明しましょうか`, `正解は何でしょう`, and any multi-question
checklist.
