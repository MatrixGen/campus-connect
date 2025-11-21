import { ValidationResult } from '../types/runner.types';

export class ValidationService {
  validateRunnerRegistration(data: any): ValidationResult {
    if (!data.areas_covered || !data.transportation_mode) {
      return {
        isValid: false,
        message: 'Missing required fields: areas_covered, transportation_mode'
      };
    }

    if (!Array.isArray(data.areas_covered)) {
      return {
        isValid: false,
        message: 'areas_covered must be an array of strings'
      };
    }

    return { isValid: true };
  }

  validateRunnerUpdate(data: any): ValidationResult {
    if (data.areas_covered && !Array.isArray(data.areas_covered)) {
      return {
        isValid: false,
        message: 'areas_covered must be an array of strings'
      };
    }

    return { isValid: true };
  }
}

export default new ValidationService();