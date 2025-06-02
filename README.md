# Natter - WebRTC Video Calling App

This is a simple frontend application for 1-on-1 video calling using WebRTC and Firebase Firestore for signalling.

**Deployed Application:** [https://natter-webrtc.vercel.app/](https://natter-webrtc.vercel.app/)

## Project Overview

This application allows users to:

- Start their webcam and microphone.
- Create a unique call ID to share with another user.
- Join an existing call using a call ID.
- Engage in a video call.
- Hang up the call.

This project was developed as a frontend engineering exercise. It does not involve a custom backend signalling server; instead, it utilizes Firebase Firestore for exchanging WebRTC signalling messages (offers, answers, and ICE candidates).

## Running Locally (Optional)

1.  **Clone the repository:**
    ```bash
    git clone git@github.com:alexdorosin/natter-webrtc.git
    cd natter-webrtc
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up environment variables:**
    Create a `.env.local` file in the project root and add your Firebase configuration and a demo password:
    ```env
    VITE_FIREBASE_API_KEY="YOUR_FIREBASE_API_KEY"
    VITE_FIREBASE_AUTH_DOMAIN="YOUR_FIREBASE_AUTH_DOMAIN"
    VITE_FIREBASE_PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"
    VITE_FIREBASE_STORAGE_BUCKET="YOUR_FIREBASE_STORAGE_BUCKET"
    VITE_FIREBASE_MESSAGING_SENDER_ID="YOUR_FIREBASE_MESSAGING_SENDER_ID"
    VITE_FIREBASE_APP_ID="YOUR_FIREBASE_APP_ID"
    VITE_DEMO_PASSWORD="your_local_demo_password"
    ```
4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`

## QA Instructions - Testing the Deployed Application

To test the video calling functionality, you'll ideally need two separate browser windows/tabs or two different devices (e.g., two laptops, or a laptop and a smartphone with a compatible browser).

**Password:**

- The deployed application on Vercel is protected by a simple password prompt.
- **Please use the password provided on email.**

**Testing Steps:**

1.  **Open the App (Instance 1):**

    - Navigate to [https://natter-webrtc.vercel.app/](https://natter-webrtc.vercel.app/) in your first browser tab/device.
    - Enter the demo password when prompted.
    - Click the "**Start Webcam**" button. Allow browser permissions for camera and microphone if requested.
    - You should see your local video feed.

2.  **Open the App (Instance 2):**

    - Navigate to [https://natter-webrtc.vercel.app/](https://natter-webrtc.vercel.app/) in your second browser tab/device.
    - Enter the demo password when prompted.
    - Click the "**Start Webcam**" button. Allow browser permissions.
    - You should see your local video feed on this instance as well.

3.  **Create a Call (Instance 1):**

    - On Instance 1 (where you first started the webcam), click the "**Create Call**" button.
    - A "Call ID" will be generated and displayed in the input field (e.g., `abcdef12345`).
    - **Copy this Call ID.**

4.  **Join the Call (Instance 2):**

    - On Instance 2, paste the copied Call ID into the "Enter Call ID" input field.
    - Click the "**Answer**" button.

5.  **Test Video Call:**

    - After a few moments for the WebRTC connection to establish, you should see the video from Instance 1 appearing in the "Remote" video slot on Instance 2, and vice-versa.
    - Test audio by speaking (ensure your microphone is not muted).

6.  **Test Hangup:**
    - On either Instance 1 or Instance 2, click the red "**Hangup**" button (call end icon).
    - The call should terminate. Both video feeds (local and remote) should stop or reset.
    - The UI should return to a state where you can start a new webcam session or create/join a new call.
    - Verify that the other instance also reflects the call has ended (e.g., remote video disappears, UI may reset).

**Expected Behavior / What to Look For:**

- Successful acquisition of camera/microphone.
- Clear display of local and remote video streams.
- Synchronized audio.
- Graceful call termination and UI reset upon hanging up.
- Button states (disabled/enabled) should update correctly based on the application state.
- Error messages (if any) should be clear (though extensive custom error UI is not a primary feature of this demo).

## Assumptions & Limitations

- **Signalling:** Uses Firebase Firestore for signalling. This means there's a dependency on Firebase services being available.
- **Browser Compatibility:** Primarily tested on modern desktop versions of Chrome and Firefox. Other browsers supporting WebRTC should work but may have minor differences.
- **Error Handling:** Basic error handling is in place (console logs, alerts). Production-level error reporting and recovery are not implemented.
- **Security of Demo Password:** The password prompt is a very basic client-side deterrent for the deployed demo and is not a secure authentication mechanism. The password itself is embedded in the deployed client-side code (though not in the repository source).
- **No Backend Server:** As per the assignment, no custom backend logic/server was built. All operations are client-side or interact with Firebase BaaS.
