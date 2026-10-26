// Something@domain.tld with no spaces. No part of the domain holds a dot, so
// each character can only belong to one part: a long address with no dot fails
// in linear time instead of backtracking through every split.
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

/** Whether `value` looks like an email address. */
export function isEmail(value: string) {
  return EMAIL.test(value)
}
