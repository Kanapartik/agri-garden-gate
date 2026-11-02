import { describe,it,expect } from 'vitest';
import { normalizeFieldworkLogin,validNewFieldworkPassword,fieldworkStatus } from './identity';
describe('fieldwork login identifiers',()=>{
 it('accepts an assigned ten-digit ID and Nigerian local/international formats',()=>{expect(normalizeFieldworkLogin('8123456789')).toBe('8123456789');expect(normalizeFieldworkLogin('08123456789')).toBe('8123456789');expect(normalizeFieldworkLogin('+234 812 345 6789')).toBe('8123456789');});
 it('rejects letters, missing digits and unexpected country prefixes',()=>{for(const v of ['0812abc6789','1234','+918123456789',null])expect(normalizeFieldworkLogin(v)).toBeNull();});
 it('does not guess a role from an identifier',()=>{expect(normalizeFieldworkLogin('1234567890')).toBe('1234567890');});
});
describe('password policy and HTTP decisions',()=>{
 it('requires a sufficiently long mixed password',()=>{expect(validNewFieldworkPassword('Fixture-Safe2026!')).toBe(true);for(const value of ['short1!A','lowercaseonly123!','UPPERCASEONLY123!','MissingSymbol2026','MissingNumbers!!!'])expect(validNewFieldworkPassword(value)).toBe(false);});
 it('rejects bcrypt truncation and excessive UTF-8 byte length',()=>{expect(validNewFieldworkPassword('A1!'+ 'a'.repeat(70))).toBe(false);expect(validNewFieldworkPassword('A1!'+ 'é'.repeat(36))).toBe(false);});
 it('keeps authorization, forced changes and version conflicts distinct',()=>{expect(fieldworkStatus('forbidden')).toBe(403);expect(fieldworkStatus('password_change_required')).toBe(428);expect(fieldworkStatus('conflict')).toBe(409);expect(fieldworkStatus('try_later')).toBe(429);});
});
