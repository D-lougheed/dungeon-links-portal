
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Swords, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const Auth = () => {
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [signInError, setSignInError] = useState('');
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSignInError('');

    const { error } = await signIn(signInData.email, signInData.password);
    
    if (error) {
      setSignInError(error.message);
      setSignInData({ ...signInData, password: '' });
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSignUpError('');
    setSignUpSuccess('');

    if (signUpData.password !== signUpData.confirmPassword) {
      setSignUpError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (signUpData.password.length < 6) {
      setSignUpError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(
      signUpData.email, 
      signUpData.password, 
      signUpData.firstName, 
      signUpData.lastName
    );
    
    if (error) {
      setSignUpError(error.message);
    } else {
      setSignUpSuccess('Account created successfully! Please check your email to verify your account.');
      setSignUpData({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: ''
      });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="w-full max-w-md">
        <Card className="border-2 border-amber-200 shadow-2xl bg-gradient-to-b from-amber-50 to-orange-50">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Shield className="h-12 w-12 text-amber-700" />
                <Swords className="h-6 w-6 text-amber-600 absolute top-3 left-3" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-amber-900">
              Campaign Portal
            </CardTitle>
            <CardDescription className="text-amber-700">
              Sign in to access your D&D campaign tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-amber-800 font-medium">
                      Email
                    </Label>
                    <Input
                      id="signin-email"
                      type="email"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-amber-800 font-medium">
                      Password
                    </Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                      required
                    />
                  </div>
                  {signInError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">
                      <AlertCircle className="h-4 w-4" />
                      {signInError}
                    </div>
                  )}
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                  >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname" className="text-amber-800 font-medium">
                        First Name
                      </Label>
                      <Input
                        id="signup-firstname"
                        type="text"
                        value={signUpData.firstName}
                        onChange={(e) => setSignUpData({ ...signUpData, firstName: e.target.value })}
                        className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-lastname" className="text-amber-800 font-medium">
                        Last Name
                      </Label>
                      <Input
                        id="signup-lastname"
                        type="text"
                        value={signUpData.lastName}
                        onChange={(e) => setSignUpData({ ...signUpData, lastName: e.target.value })}
                        className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-amber-800 font-medium">
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-amber-800 font-medium">
                      Password
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password" className="text-amber-800 font-medium">
                      Confirm Password
                    </Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      value={signUpData.confirmPassword}
                      onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                      className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                      required
                    />
                  </div>
                  {signUpError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">
                      <AlertCircle className="h-4 w-4" />
                      {signUpError}
                    </div>
                  )}
                  {signUpSuccess && (
                    <div className="text-green-600 text-sm bg-green-50 p-2 rounded border border-green-200">
                      {signUpSuccess}
                    </div>
                  )}
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                  >
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
