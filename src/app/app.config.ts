import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideFirebaseApp(() => initializeApp({"projectId":"dos-cms","appId":"1:814584510331:web:f889dddea1544cca956fde","databaseURL":"https://dos-cms-default-rtdb.europe-west1.firebasedatabase.app","storageBucket":"dos-cms.firebasestorage.app","apiKey":"AIzaSyBGhsxjyVgwCBjtzW6wfHVPn_Y0i0BmKts","authDomain":"dos-cms.firebaseapp.com","messagingSenderId":"814584510331","measurementId":"G-71GDHG6N7D"})), provideAuth(() => getAuth()), provideFirestore(() => getFirestore())]
};
