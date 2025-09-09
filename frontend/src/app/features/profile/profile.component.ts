import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 py-8">
      <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Back Button -->
        <div class="mb-6">
          <button 
            (click)="goBack()"
            class="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            <span>Back to Dashboard</span>
          </button>
        </div>

        <div class="bg-white shadow rounded-lg">
          <!-- Header -->
          <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 class="text-lg leading-6 font-medium text-gray-900">Profile Settings</h3>
            <p class="mt-1 max-w-2xl text-sm text-gray-500">
              Manage your account settings and preferences.
            </p>
          </div>

          <!-- User Info -->
          <div class="px-4 py-5 sm:p-6 border-b border-gray-200">
            <h4 class="text-base font-medium text-gray-900 mb-4">Account Information</h4>
            <div *ngIf="currentUser" class="space-y-3">
              <div>
                <label class="text-sm font-medium text-gray-500">Name</label>
                <p class="text-sm text-gray-900">{{ currentUser.firstName }} {{ currentUser.lastName }}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">Email</label>
                <p class="text-sm text-gray-900">{{ currentUser.email }}</p>
              </div>
              <div>
                <label class="text-sm font-medium text-gray-500">Role</label>
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                      [class]="currentUser.isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'">
                  {{ currentUser.isAdmin ? 'Administrator' : 'Regular User' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Password Change Form -->
          <div class="px-4 py-5 sm:p-6">
            <h4 class="text-base font-medium text-gray-900 mb-4">Change Password</h4>
            
            <!-- Success Message -->
            <div *ngIf="successMessage" 
                 class="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p class="text-sm text-green-800">{{ successMessage }}</p>
            </div>

            <!-- Error Message -->
            <div *ngIf="errorMessage" 
                 class="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p class="text-sm text-red-800">{{ errorMessage }}</p>
            </div>

            <form [formGroup]="passwordForm" (ngSubmit)="onSubmit()" class="space-y-4">
              <!-- Current Password -->
              <div>
                <label for="currentPassword" class="block text-sm font-medium text-gray-700">
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  formControlName="currentPassword"
                  class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  [class.border-red-500]="passwordForm.get('currentPassword')?.invalid && passwordForm.get('currentPassword')?.touched"
                />
                <div *ngIf="passwordForm.get('currentPassword')?.invalid && passwordForm.get('currentPassword')?.touched"
                     class="mt-1 text-sm text-red-600">
                  Current password is required
                </div>
              </div>

              <!-- New Password -->
              <div>
                <label for="newPassword" class="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  formControlName="newPassword"
                  class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  [class.border-red-500]="passwordForm.get('newPassword')?.invalid && passwordForm.get('newPassword')?.touched"
                />
                <div *ngIf="passwordForm.get('newPassword')?.invalid && passwordForm.get('newPassword')?.touched"
                     class="mt-1 text-sm text-red-600">
                  <span *ngIf="passwordForm.get('newPassword')?.errors?.['required']">
                    New password is required
                  </span>
                  <span *ngIf="passwordForm.get('newPassword')?.errors?.['minlength']">
                    Password must be at least 6 characters long
                  </span>
                </div>
              </div>

              <!-- Confirm Password -->
              <div>
                <label for="confirmPassword" class="block text-sm font-medium text-gray-700">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  formControlName="confirmPassword"
                  class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  [class.border-red-500]="passwordForm.get('confirmPassword')?.invalid && passwordForm.get('confirmPassword')?.touched"
                />
                <div *ngIf="passwordForm.get('confirmPassword')?.invalid && passwordForm.get('confirmPassword')?.touched"
                     class="mt-1 text-sm text-red-600">
                  <span *ngIf="passwordForm.get('confirmPassword')?.errors?.['required']">
                    Please confirm your new password
                  </span>
                  <span *ngIf="passwordForm.get('confirmPassword')?.errors?.['mismatch']">
                    Passwords do not match
                  </span>
                </div>
              </div>

              <!-- Submit Button -->
              <div class="flex justify-end">
                <button
                  type="submit"
                  [disabled]="passwordForm.invalid || isLoading"
                  class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span *ngIf="isLoading" class="mr-2">
                    <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                  {{ isLoading ? 'Changing Password...' : 'Change Password' }}
                </button>
              </div>
            </form>

            <!-- Password Requirements -->
            <div class="mt-4 p-3 bg-gray-50 rounded-md">
              <h5 class="text-sm font-medium text-gray-700 mb-2">Password Requirements:</h5>
              <ul class="text-xs text-gray-600 space-y-1">
                <li>• At least 6 characters long</li>
                <li>• Must be different from your current password</li>
                <li>• Will take effect immediately after change</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ProfileComponent {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  passwordForm: FormGroup = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');

    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ mismatch: true });
      return { mismatch: true };
    }

    if (confirmPassword?.errors?.['mismatch']) {
      delete confirmPassword.errors['mismatch'];
      if (Object.keys(confirmPassword.errors).length === 0) {
        confirmPassword.setErrors(null);
      }
    }

    return null;
  }

  onSubmit() {
    if (this.passwordForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';

    const { currentPassword, newPassword } = this.passwordForm.value;

    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage = response.message;
        this.passwordForm.reset();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Failed to change password. Please try again.';
      }
    });
  }

  private markFormGroupTouched() {
    Object.keys(this.passwordForm.controls).forEach(key => {
      const control = this.passwordForm.get(key);
      control?.markAsTouched();
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
