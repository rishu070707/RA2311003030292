# Notification System Architecture Design

*Prepared for the AffordMed Backend Evaluation Track*

## 1. High-Level Concept
For this notification system, I opted to build an asynchronous, event-driven architecture. The main goal here is to make sure that the core applications (like booking or scheduling) aren't slowed down waiting for an email or SMS to physically send. By decoupling the notification trigger from the actual delivery mechanism using a message broker, we can achieve high throughput and avoid blocking the main event loop.

## 2. Core Modules Breakdown

### A. The Ingestion API (Gateway)
- **Role:** This is the entry point. Whenever any internal AffordMed service needs to alert a user, it hits this REST endpoint.
- **Behavior:** It immediately runs some lightweight validation on the payload (checking if the user ID and message body exist) and drops the event straight into our message broker. It then fires back a `202 Accepted` response to the client so they can move on without waiting.

### B. Event Broker (RabbitMQ / Kafka)
- **Role:** Serves as the holding pen for our notifications. 
- **Setup:** I would configure specific topics based on the channel type and urgency. For example, OTPs or booking confirmations would go into a `high-priority-sms` queue, while weekly newsletters get dumped into a `low-priority-email` queue.
- **Why?** If the third-party email provider goes down, the broker just holds onto the messages securely until the provider comes back online. No data loss.

### C. Worker Nodes (Consumers)
- **Role:** These are independent Node.js processes sitting on the other side of the queue.
- **Flow:** They pick up tasks from the broker, reach into the database to check if the user actually has that notification type enabled (respecting user preferences), compile the final message template, and prep it for dispatch.

### D. Provider Integration Layer
- **Role:** The actual dispatcher talking to external APIs.
- **Tech Choices:** We can integrate SendGrid for emails, Twilio for SMS, and Firebase (FCM) for mobile push.
- **Safeguards:** This layer has exponential backoff and retry logic built in. If Twilio rate-limits us, the worker backs off and retries in 5 seconds, then 10 seconds, etc.

### E. Tracking & Audit Database (PostgreSQL)
- **Role:** A relational database to maintain the state of every single alert.
- **States:** It tracks the transition from `QUEUED` -> `DISPATCHED` -> `DELIVERED` -> `FAILED`. This is crucial for customer support to verify if an alert actually went out.

## 3. Step-by-Step Delivery Flow
1. An internal service posts a JSON request to the Ingestion API.
2. The API authenticates the request and queues it in RabbitMQ.
3. A Consumer Node pulls the message, checks user preferences, and formats the text.
4. The message is pushed to the Provider Layer which fires it off to SendGrid/Twilio.
5. The Provider returns a webhook confirming delivery, updating our PostgreSQL database.

## 4. How We Handle Scale
- **Auto-scaling:** If the queue depth in RabbitMQ spikes (e.g., during a massive marketing blast), we can spin up more Worker Nodes dynamically to drain the queue faster.
- **Dead Letters:** If a message completely fails after 5 retries (maybe the user's phone number is invalid), it gets routed to a "Dead Letter Queue" (DLQ) so developers can manually inspect the failure without it clogging up the main pipeline.
