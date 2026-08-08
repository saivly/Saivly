import * as zod from 'zod';
import { PASSWORD_REGEX, PASSWORD_HINT } from './password-policy';

export const signupSchema = zod.object({
    firstname: zod.string().min(1, { message: 'First name is required' }),
    lastname: zod.string().min(1, { message: 'Last name is required' }),
    email: zod.email({ message: 'Invalid email address' }),
    // Individual requirements are surfaced separately via passwordRequirements
    // in the checklist UI; this just gates overall form validity.
    password: zod.string().regex(PASSWORD_REGEX, { message: PASSWORD_HINT }),
})

export const loginSchema = zod.object({
    email: zod.email({ message: 'Invalid email address' }),
    password: zod.string().min(1, {message: 'Please provide a valid password.'}),
})

