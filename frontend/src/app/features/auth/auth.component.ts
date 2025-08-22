import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {{ isLogin ? 'Sign in to your account' : 'Create your account' }}
          </h2>
          <p class="mt-2 text-center text-sm text-gray-600">
            NFL Weekly Picks
          </p>
        </div>
        
        <form class="mt-8 space-y-6" [formGroup]="authForm" (ngSubmit)="onSubmit()">
          <div class="space-y-4">
            <div *ngIf="!isLogin" class="grid grid-cols-2 gap-4">
              <div>
                <label for="firstName" class="sr-only">First Name</label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  formControlName="firstName"
                  class="input-field"
                  placeholder="First Name">
              </div>
              <div>
                <label for="lastName" class="sr-only">Last Name</label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  formControlName="lastName"
                  class="input-field"
                  placeholder="Last Name">
              </div>
            </div>
            
            <div>
              <label for="email" class="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                formControlName="email"
                class="input-field"
                placeholder="Email address">
            </div>
            
            <div>
              <label for="password" class="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                formControlName="password"
                class="input-field"
                placeholder="Password">
            </div>
          </div>

          <div *ngIf="error" class="text-red-600 text-sm text-center">
            {{ error }}
          </div>

          <div>
            <button
              type="submit"
              [disabled]="authForm.invalid || loading"
              class="btn-primary w-full">
              {{ loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up') }}
            </button>
          </div>

          <div class="text-center">
            <button
              type="button"
              (click)="toggleMode()"
              class="text-blue-600 hover:text-blue-500">
              {{ isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: []
})
export class AuthComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isLogin = true;
  loading = false;
  error = '';

  authForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    firstName: [''],
    lastName: ['']
  });

  ngOnInit() {
    // Redirect if already authenticated
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/dashboard']);
    }

    this.updateValidators();
  }

  toggleMode() {
    this.isLogin = !this.isLogin;
    this.error = '';
    this.updateValidators();
  }

  private updateValidators() {
    const firstNameControl = this.authForm.get('firstName');
    const lastNameControl = this.authForm.get('lastName');

    if (this.isLogin) {
      firstNameControl?.clearValidators();
      lastNameControl?.clearValidators();
    } else {
      firstNameControl?.setValidators([Validators.required]);
      lastNameControl?.setValidators([Validators.required]);
    }

    firstNameControl?.updateValueAndValidity();
    lastNameControl?.updateValueAndValidity();
  }

  onSubmit() {
    if (this.authForm.invalid) return;

    this.loading = true;
    this.error = '';

    const formValue = this.authForm.value;

    const request$ = this.isLogin 
      ? this.authService.login({ email: formValue.email, password: formValue.password })
      : this.authService.register({
          email: formValue.email,
          password: formValue.password,
          firstName: formValue.firstName,
          lastName: formValue.lastName
        });

    request$.subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (error: any) => {
        this.error = error.error?.message || 'Authentication failed';
        this.loading = false;
      }
    });
  }
}
