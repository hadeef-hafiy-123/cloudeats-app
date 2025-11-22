// ========== VALIDATION FUNCTIONS ==========

/**
 * Validate rating value
 * @param {number} rating - Rating value (1-5)
 * @returns {object} - { valid: boolean, error: string }
 */
function validateRating(rating) {
  // Check if rating exists
  if (rating === undefined || rating === null) {
    return { valid: false, error: 'Rating is required' };
  }
  
  // Convert to number
  const ratingNum = Number(rating);
  
  // Check if valid number
  if (isNaN(ratingNum)) {
    return { valid: false, error: 'Rating must be a number' };
  }
  
  // Check range
  if (ratingNum < 1 || ratingNum > 5) {
    return { valid: false, error: 'Rating must be between 1 and 5' };
  }
  
  // Check if integer
  if (!Number.isInteger(ratingNum)) {
    return { valid: false, error: 'Rating must be a whole number' };
  }
  
  return { valid: true };
}

// ========== END VALIDATION FUNCTIONS ==========
