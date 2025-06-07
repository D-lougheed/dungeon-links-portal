
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Swords } from 'lucide-react';

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(username, password);
    if (!success) {
      setError('Invalid credentials. Please try again.');
      setUsername('');
      setPassword('');
    }
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
              Enter your credentials to access the D&D campaign tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-amber-800 font-medium">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-amber-800 font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                  required
                />
              </div>
              {error && (
                <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded border border-red-200">
                  {error}
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold py-2 px-4 rounded-md transition-colors"
              >
                Enter Campaign
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginForm;
