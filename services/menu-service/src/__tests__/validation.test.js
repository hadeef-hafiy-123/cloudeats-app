/**
 * Unit Tests for Rating Validation
 * Tests the validateRating() function from Lab 5.1
 */

// Import the function we want to test
// Note: We need to export it from server.js first
const { validateRating } = require('../server');

// Describe what we're testing
describe('validateRating Function', () => {
  
  // Test 1: Valid ratings should pass
  test('should accept valid rating of 5', () => {
    const result = validateRating(5);
    expect(result.valid).toBe(true);
  });
  
  test('should accept valid rating of 1', () => {
    const result = validateRating(1);
    expect(result.valid).toBe(true);
  });
  
  test('should accept valid rating of 3', () => {
    const result = validateRating(3);
    expect(result.valid).toBe(true);
  });
  
  // Test 2: Invalid ratings should fail
  test('should reject rating above 5', () => {
    const result = validateRating(6);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Rating must be between 1 and 5');
  });
  
  test('should reject rating of 0', () => {
    const result = validateRating(0);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Rating must be between 1 and 5');
  });
  
  test('should reject negative rating', () => {
    const result = validateRating(-1);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Rating must be between 1 and 5');
  });
  
  test('should reject decimal rating', () => {
    const result = validateRating(3.5);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Rating must be a whole number');
  });
  
  // Test 3: Edge cases
  test('should reject undefined rating', () => {
    const result = validateRating(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Rating is required');
  });
  
  test('should reject null rating', () => {
    const result = validateRating(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Rating is required');
  });
  
  test('should reject string rating', () => {
    const result = validateRating('five');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Rating must be a number');
  });
  
  // Test 4: Boundary testing
  test('should accept boundary value of 1', () => {
    const result = validateRating(1);
    expect(result.valid).toBe(true);
  });
  
  test('should accept boundary value of 5', () => {
    const result = validateRating(5);
    expect(result.valid).toBe(true);
  });
});
