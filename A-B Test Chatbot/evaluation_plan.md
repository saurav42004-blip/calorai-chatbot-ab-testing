# CalorAI A/B Test — Evaluation Plan

## Experiment Overview

| Item | Detail |
|---|---|
| **Experiment name** | CalorAI Onboarding A/B Test v1 |
| **Hypothesis** | A guided 3-step onboarding flow increases user activation and 7-day retention compared to a generic welcome message |
| **Assignment method** | Statsig feature gate — 50/50 split, assigned on first message |
| **Unit of randomisation** | `user_id` (Telegram chat ID) |
| **Control** | Generic welcome message → user self-directs |
| **Test** | 3-step guided onboarding (breakfast → goal → meal frequency) |

---

## 1. Primary Metric

### Onboarding Completion Rate (Test group only)
**Definition:** % of test-group users who reach `onboarding_step = 4` (i.e., answer all 3 questions).

**SQL:**
```sql
SELECT
  COUNT(*) FILTER (WHERE onboarding_step = 4) * 100.0 / COUNT(*) AS completion_rate
FROM users
WHERE "group" = 'test';
```

**Why this is the primary metric:**
- It is a direct measure of whether the test treatment is working at all
- Completion is a strong leading indicator of long-term retention — users who invest effort in setup have higher intent to return
- It is observable within hours of user arrival, making it a fast feedback signal
- Industry benchmarks suggest onboarding completion rates above 60% correlate with significantly better Day-7 retention

**Minimum Detectable Effect (MDE):** 10 percentage points absolute (e.g., 40% → 50%)

**Required sample size (per group):** ~400 users (α = 0.05, power = 0.80, two-tailed)

---

## 2. Guardrail Metrics

These must NOT degrade for the experiment to be considered a success. If any guardrail is violated, the experiment must be stopped regardless of the primary metric result.

### 2a. Bot Block Rate
**Definition:** % of users who block the bot within 24 hours of first interaction.

**Why:** The onboarding flow sends more messages than the control. If users find it annoying or intrusive, they will block the bot. A higher block rate in the test group would mean the onboarding causes net harm.

**Threshold:** Block rate in test must not exceed control block rate by more than **5 percentage points**.

**How to measure:** Telegram `getChatMember` API returns error 403 when a user has blocked the bot. Log these as `bot_blocked` events.

---

### 2b. Step Drop-off at Step 1
**Definition:** % of test-group users who receive Step 1 but never reply (i.e., remain at `onboarding_step = 1` after 48 hours).

**Why:** If more than half of test users abandon at the very first question, the onboarding design is causing friction rather than activation.

**Threshold:** Must remain below **60%** drop-off at Step 1.

**SQL:**
```sql
SELECT
  COUNT(*) FILTER (WHERE onboarding_step = 1
    AND created_at < NOW() - INTERVAL '48 hours') * 100.0 / COUNT(*) AS step1_dropout_rate
FROM users
WHERE "group" = 'test';
```

---

### 2c. Workflow Error Rate
**Definition:** % of incoming messages that result in a failed n8n execution.

**Why:** A broken onboarding flow is worse than no onboarding. Monitor n8n execution logs.

**Threshold:** Must remain below **2%**.

---

## 3. Secondary Metrics

These inform the interpretation of results but do not alone determine the ship decision.

### 3a. Day-1 Return Rate
**Definition:** % of users who send at least one message in the 24 hours after their first message.

**SQL:**
```sql
SELECT
  u."group",
  COUNT(DISTINCT e.user_id) * 100.0 / COUNT(DISTINCT u.user_id) AS day1_return_rate
FROM users u
LEFT JOIN events e
  ON u.user_id = e.user_id
  AND e.event_time BETWEEN u.created_at + INTERVAL '1 hour'
                       AND u.created_at + INTERVAL '25 hours'
GROUP BY u."group";
```

---

### 3b. Day-7 Return Rate
**Definition:** % of users who send at least one message between Day 6 and Day 8 after signup.

**Why:** The strongest predictor of long-term retention. This is the metric the experiment is ultimately trying to move.

**SQL:**
```sql
SELECT
  u."group",
  COUNT(DISTINCT e.user_id) * 100.0 / COUNT(DISTINCT u.user_id) AS day7_return_rate
FROM users u
LEFT JOIN events e
  ON u.user_id = e.user_id
  AND e.event_time BETWEEN u.created_at + INTERVAL '6 days'
                       AND u.created_at + INTERVAL '8 days'
GROUP BY u."group";
```

---

### 3c. Step-by-Step Drop-off (Funnel)
**Definition:** For test-group users, the % who reach each onboarding step.

| Step | Event logged | Measures |
|---|---|---|
| Step 1 sent | `onboarding_step_1_sent` | Reach rate |
| Step 2 sent | `onboarding_step_2_sent` | Step 1 answer rate |
| Step 3 sent | `onboarding_step_3_sent` | Step 2 answer rate |
| Onboarding complete | `onboarding_complete` | Full completion rate |

**SQL:**
```sql
SELECT
  event_name,
  COUNT(DISTINCT user_id) AS users,
  COUNT(DISTINCT user_id) * 100.0 /
    MAX(COUNT(DISTINCT user_id)) OVER () AS pct_of_entered
FROM events
WHERE event_name IN (
  'onboarding_step_1_sent',
  'onboarding_step_2_sent',
  'onboarding_step_3_sent',
  'onboarding_complete'
)
GROUP BY event_name
ORDER BY users DESC;
```

---

### 3d. Time to Complete Onboarding
**Definition:** Median time (in minutes) between `onboarding_step_1_sent` and `onboarding_complete` for users who complete all steps.

**Why:** Long completion times suggest friction or confusion in the questions. Target median < 10 minutes.

---

### 3e. Messages Logged per User (Days 1–7)
**Definition:** Average number of meal-log messages per user in the first 7 days.

**Why:** Measures whether the onboarding actually increases the core product behaviour (meal logging), not just engagement with the bot itself.

---

## 4. Pre-Committed Decision Framework

### 4.1 Run Duration
- **Minimum:** 14 days (to capture weekly behaviour patterns)
- **Maximum:** 30 days (beyond this, mix of early/late adopters distorts results)
- Do not peek at results and make decisions before Day 14

### 4.2 Statistical Significance
- **Significance level (α):** 0.05 (two-tailed)
- **Power (1−β):** 0.80
- Use a **two-proportion z-test** for the primary metric
- Apply **Bonferroni correction** for secondary metrics (α / number of secondary metrics)

### 4.3 Ship Decision Rules

| Scenario | Decision |
|---|---|
| Primary metric positive (p < 0.05) AND no guardrail violated | ✅ **Ship test group onboarding** |
| Primary metric positive BUT guardrail violated | ⛔ **Do not ship** — fix the onboarding friction first, re-run |
| Primary metric not significant AND Day-7 return rate positive (p < 0.05) | 🔁 **Extend run** by 7 days, re-evaluate |
| Primary metric negative (test completion rate lower) | ❌ **Discard** — simplify or redesign onboarding |
| Any guardrail exceeds threshold at any point | 🛑 **Stop experiment immediately** |

### 4.4 Novelty Effect Check
After the experiment, verify that Day-1 and Day-7 return rates show consistent trends. If Day-1 is high but Day-7 drops sharply, the result may be driven by curiosity rather than genuine activation — in this case, extend the experiment window.

### 4.5 Segment Analysis (Post-hoc)
After the primary decision, analyse results broken down by:
- **Time of day** (morning vs evening first message — may indicate different intent)
- **Step drop-off point** — which question causes the most abandonment
- **Onboarding completion vs Day-7 retention** — validate that completers do retain better

---

## 5. Events Logged (Reference)

| Event name | Logged when | Group |
|---|---|---|
| `user_assigned` | User first assigned to group | Both |
| `control_start` | Control welcome message sent | Control |
| `onboarding_step_1_sent` | Step 1 question sent | Test |
| `onboarding_step_2_sent` | User answered step 1, step 2 sent | Test |
| `onboarding_step_3_sent` | User answered step 2, step 3 sent | Test |
| `onboarding_complete` | User answered step 3 | Test |
| `returning_user` | Existing user sends a message | Both |
| `bot_blocked` | Telegram returns 403 for this user | Both |

---

## 6. Sample Size Calculator Reference

For the primary metric (onboarding completion rate):

```
Baseline rate (control has no onboarding → assumed 0%): —
Test baseline (expected completion rate without optimisation): 40%
MDE: 10 pp → target 50%
α = 0.05, power = 0.80
Required n per group ≈ 390 users
Total required ≈ 780 users
```

At typical Telegram bot growth rates, plan for the 14-day minimum to reach this sample size. If growth is slow, extend to 30 days before calling the result.
