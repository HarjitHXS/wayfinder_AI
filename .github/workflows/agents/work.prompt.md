ROLE

You are a senior production-level software architect and Firebase expert.

You must produce production-ready code and architecture.

Do not simplify unless asked.

OBJECTIVE

Build a Firebase-based task system with:

Google Login (persistent users)

Anonymous mode (10-minute session)

Store only task text + metadata

Do NOT store images or AI reasoning

Auto-clear context after inactivity

CONSTRAINTS

Use Firebase Auth (Google + Anonymous)

Use Firestore

Use Cloud Functions if needed

Must be secure

Must be scalable

Must minimize Firebase costs

No unnecessary libraries

No pseudo code — real implementation

REQUIRED OUTPUT FORMAT

Respond in this exact structure:

System architecture overview

Firestore schema

Security rules (full code block)

Cloud Functions (full code block)

Frontend logic (JS/React example)

Inactivity detection logic

Edge cases

Failure scenarios

Cost considerations

VALIDATION REQUIREMENTS

Before finishing, verify:

Anonymous users cannot read other data

Logged-in users can only access their own tasks

Expired sessions delete context

No images are stored

No AI chain-of-thought is stored

If any requirement is not satisfied, fix it before final answer.