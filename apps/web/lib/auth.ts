/* eslint-disable turbo/no-undeclared-env-vars */
import { PrismaAdapter } from '@auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from "next-auth/providers/github"
import  { prisma } from "db"
import { NextAuthOptions } from 'next-auth';
import { importJWK, jwtVerify, SignJWT, JWTPayload } from 'jose'

const jwtKey = JSON.parse(process.env.JWT_SIGNING_KEY!);

export const NEXT_AUTH_CONFIG: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET!,
    adapter: PrismaAdapter(prisma),
    session: {
      strategy: "jwt"
    },
    providers: [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
      GitHubProvider({
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      })
      
    ],
    callbacks: {
      jwt: async ({ user, token }) => {
        if (user) {
          token.id = user.id;
        }
        return token;
      },
      session: async ({ session, token }) => {
        if (token?.id) {
          session.user.id = token.id;
        }
        return session;
      }
    },
    jwt: {
      encode: async ({ token }) => {
        if (!token) return ''
        const key = await importJWK(jwtKey, 'HS512')
        return await new SignJWT(token)
          .setProtectedHeader({ alg: 'HS512' })
          .setIssuedAt()
          .setExpirationTime('30d')
          .sign(key)
      },
      decode: async ({ token }) => {
        if (!token) return null
        try {
          const key = await importJWK(jwtKey, 'HS512')
          const { payload } = await jwtVerify(token, key, {
            algorithms: ['HS512'],
          })
          return { 
            ...(payload as JWTPayload), 
            id: String((payload as JWTPayload).id || '') 
          }
        } catch (err) {
          console.error('JWT verification failed:', err)
          return null
        }
      },
  },
  pages: {
    signIn: "/signin"
  }
}
