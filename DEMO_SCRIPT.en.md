# Int3grate.ai Demo Script

This is a simple speaking script for the product demo. It follows the main user flows from `USER_FLOWS.en.md`.

Use it as a guide while you click through the prototype. The text is written in simple English, so it can be read out loud.

## Before the demo

I will show a control plane for AI agents.

This is not a chat app. This is the place where a company can manage agents, control what they can do, review risky actions, and see the cost of their work.

The app is a frontend prototype. It uses mock data in the browser. This means we can create things and make decisions, but the data is not saved to a real backend.

For the demo, I can use these accounts:

| Role | Email | Notes |
| --- | --- | --- |
| Admin | `frontend@int3grate.ai` | Full access to agents, approvals, and spend. |
| Domain Admin | `domain@int3grate.ai` | Admin for one business domain. |
| Member | `member@int3grate.ai` | Limited access. Good for showing role limits. |

Any password works in the mock app.

## Flow 1. Register a new workspace owner

**Open:** `#/register`

I am now on the registration page.

This page is for a new customer who wants to create a workspace. The user is not only creating a personal account. They are also creating a new workspace for their company.

Here I need to enter my name, workspace name, email, password, and password confirmation.

The workspace name is important because the system uses it to create the tenant. A tenant is the company space where agents, tasks, approvals, and spend live.

I will fill in the form now.

When I submit the form, the app creates a new user. This user becomes the workspace owner. In this prototype, the new user gets the admin role and approval level 4.

Now I click **Create account**.

After this, the app signs me in and sends me to the dashboard.

What to say after the redirect:

This is the main control plane. From here, an admin can see the state of the agent fleet, open tasks, review approvals, and check spend.

## Flow 2. Sign in and open the dashboard

**Open:** `#/login`

This is the sign in page.

I can sign in with a demo account. I will use the admin account because it has full access to the product.

I enter the email and password, then click **Continue**.

Now I am on the dashboard.

The dashboard is the first screen an operator sees after login. It gives a quick view of what is happening in the workspace.

At the top, there are key metrics. These cards show the current state of the control plane. For example, I can see active agents, tasks, pending approvals, and spend.

This is useful because an operator does not need to open every page one by one. They can see where attention is needed right away.

Below the metrics, I can see recent tasks. These are jobs that were sent to agents.

I can also see pending approvals. These are actions where an agent needs a human decision before it can continue.

On the left side, I have the main navigation. I can go to Agents, Tasks, Approvals, Spend, and Profile.

Some items also have badges. These badges help me see if there are active tasks or approvals waiting.

If I click **Start a task**, I go to the task creation page.

If I click **Approvals**, I go to the approvals inbox.

For now, I will go to Agents because agents are the main objects we manage in this product.

## Flow 3. Manage agents

**Open:** `#/agents`

This is the agents page.

Here I can see the agent fleet. Each row is one agent. An agent is a managed worker. It has a name, a status, an owner, a domain, and an active version.

The status tells me if the agent can run. For example, an agent can be active, paused, or draft.

The active version tells me which instructions and model settings are used when this agent runs a task.

At the top, I can filter by status. If I click **active**, I only see agents that are ready to run.

There is also a search field. I can search by name or description.

If I click a row, I open the agent detail page.

I will open one active agent now.

### Agent detail

This is the agent detail page.

At the top, I see the agent name, status, and active version.

The command bar shows important IDs: agent ID, tenant, domain, owner, active version, and last update time.

This page has three tabs: Overview, Tool grants, and Settings.

In the Overview tab, I can see the active version.

The version contains the instruction spec. This is the main instruction that tells the agent how to behave.

I can also see model settings and other config objects. These settings are shown as JSON because they come from the backend contract.

An important point: versions are immutable. If I want to change the agent instructions or model settings, I do not edit the old version. I create a new version.

If I click **New version**, I can create a new immutable version for this agent.

### Create a new version

**Open from:** Agent detail -> **New version**

This page lets an admin create a new version of the agent.

The main field is `instruction_spec`. This is where I define what the agent should do and what rules it must follow.

Below that, I can choose the primary model. I can also set max tokens and temperature.

There is a checkbox called **Activate immediately**. If this is on, the new version becomes the active version right after it is created.

Now I can click **Create and activate**.

After this, the app returns to the agent detail page, and the new version becomes the active version.

### Tool grants

**Open:** Agent detail -> Tool grants tab

Now I open the Tool grants tab.

Tool grants control what tools this agent can use.

Each grant has a tool name, a mode, a scope, and an approval setting.

The mode can be read, write, or read and write.

The scope tells where this grant applies. It can be tenant, domain, or agent.

The most important control is `approval_required`.

If this is on, the agent cannot execute this tool action without a human approval.

This is how the product keeps humans in control. The agent can prepare an action, but risky actions can stop at an approval gate.

If a write tool does not require approval, the UI warns me because that can be risky.

I can edit grants here as an admin. A member can only view this page in read-only mode.

## Flow 4. Dispatch a task

**Open:** `#/tasks/new`

Now I will start a task for an agent.

This page is called Dispatch task.

First, I select an agent. The agent must be active and must have an active version. If the agent is paused or has no active version, it cannot run.

Next, I select the task type.

There are three types:

- `chat`: a conversation-style task.
- `one_time`: a task that runs once.
- `schedule`: a task that is meant to run again later.

Now I enter a title. This is optional, but it makes the task easier to find later.

Then I enter the input. This is required. This is the message or request that the agent will receive.

Now I click **Start task**.

The app creates a new task.

After the task is created, I see a success panel. This panel shows the task ID, agent ID, version ID, type, tenant ID, and domain ID.

One important thing: the task response does not include a run ID.

This is because the orchestrator attaches a run later. In a real system, the task is created first, and then the backend starts the run.

Now I can click **Open task detail**.

### Task detail

This page shows the task metadata.

It shows the task ID, status, type, created by, assigned agent, assigned version, and timestamps.

This page is simple on purpose. It only shows the fields that the backend returns for a task.

If I want to see what the agent actually did, I need to open a run detail page.

## Flow 5. Inspect a run audit trail

**Open:** `#/runs/run_4081`

Now I am on a run detail page.

A run is the full audit trail of one agent execution.

At the top, I can see the run status, task ID, agent version ID, number of steps, token usage, and spend.

This tells me how the run behaved and how much it cost.

Below that, I can see the steps table.

Each row is one step in the run.

For example, a step can be an LLM call, a tool call, a memory read, a memory write, a validation step, or an approval gate.

I can click a step to expand it.

When I expand a step, I can see the input and output data as JSON.

This is useful for debugging. It also helps an operator understand why the agent made a decision.

In this run, I can see that the status is suspended.

That means the agent reached a point where it cannot continue without human approval.

The suspended stage tells me where the run stopped.

This is the key trust point: the agent does not silently execute risky actions. It pauses and asks a human.

If I open a failed run, I can also see an error message. This explains why the run failed.

## Flow 6. Review and decide an approval

**Open:** `#/approvals`

Now I am on the approvals inbox.

This page shows actions that need a human decision.

Each approval has an ID, a requested action, the person or agent that requested it, the required approver role, status, and expiration time.

I can filter approvals by status. For example, I can show only pending approvals.

I will open a pending approval now.

### Approval detail

This is the approval detail page.

At the top, I see the requested action. This is the action the agent wants to perform.

I can also see the linked run and linked task. These links are important because I can inspect the full context before I decide.

The command bar shows the approval ID, run ID, task ID, required role, and expiration time.

Below that, I see a decision panel.

I can choose **Approve** or **Reject**.

Approval means the suspended run can continue.

Reject means the requested action will not happen, and the run will be stopped.

Before I decide, I can scroll down and see the evidence data.

The evidence is shown as JSON. This is the data the approver uses to make a decision.

Now I will choose **Approve**.

The UI shows a confirmation panel. It explains what will happen next.

For approve, the reason is optional.

Now I click **Approve - resume run**.

The approval status changes to approved.

The mock API also updates the related run. The suspended run becomes running again.

Now I can click **Open run** to see the result.

### Reject option

If I choose **Reject**, the reason becomes required.

This is important because a rejection should leave an audit note.

After I submit the rejection, the requested action is stopped.

The related run is moved toward cancelled state.

This shows the main safety pattern of the product: the agent can request an action, but a human makes the final decision for risky work.

## Flow 7. Review spend

**Open:** `#/spend`

Now I am on the spend page.

This page is for admins and domain admins.

It helps the operator understand where money is being spent.

At the top, I can see total spend for the selected time range.

There are also summary cards for total runs and token usage.

I can change the range. The options are 1 day, 7 days, 30 days, and 90 days.

When I click a range, the numbers update for that time window.

I can also change `group_by`.

If I choose agent, I see spend by agent.

If I choose user, I see spend by user.

The chart shows which group has the largest share of spend.

Below the chart, there is a table.

The table shows each row with spend, run count, input tokens, output tokens, and date.

If I am grouping by agent, I can click a row and open that agent.

This helps me connect cost back to the agent configuration.

This page is not a billing system. It is a visibility page. It helps the operator see which agents or users are driving cost.

## Flow 8. Show roles and access control

**Open:** `#/profile`

Now I will show role-based access.

First, I open the profile page as an admin.

This page shows the current user name, email, role, tenant ID, domain ID, and approval level.

Approval level is important because approvals can require different levels of authority.

As an admin, I can open Spend. I can create agents. I can create versions. I can edit tool grants.

Now I will sign out and sign in as a member.

As a member, the app is more limited.

If I try to open Spend, I see a no-access state.

If I try to create an agent, I also see a no-access state.

If I open tool grants, I can view them, but I cannot manage them.

This shows the enterprise control model.

Different users can do different things:

- Admins manage the full tenant.
- Domain admins manage their domain.
- Members can dispatch work, but they cannot change fleet policy.

This is important because AI agents need clear limits. The product must show who can create, who can configure, and who can approve.

## Closing summary

This demo shows the full control plane loop.

First, we create or sign in to a workspace.

Then we see the dashboard and understand the current state.

Next, we manage agents, versions, and tool grants.

Then we dispatch a task to an agent.

After that, we inspect the run audit trail.

When the agent reaches a risky action, it stops and asks for approval.

A human reviews the evidence and approves or rejects the action.

Finally, the spend page shows the cost of agent work.

The main idea is simple:

Agents can do work, but humans stay in control.

