import * as Sentry from "@sentry/nextjs";
import { clientSentryOptions } from "./lib/sentry";

Sentry.init(clientSentryOptions);
