# FantaChat iOS build

The repository now contains the Capacitor configuration for the iOS project.
The native iOS folder must be generated on macOS because Xcode is required.

## First setup on the Mac

From the project folder, run:

```bash
npm install
npm run mobile:add:ios
npm run mobile:assets:ios
npm run mobile:sync:ios
npm run mobile:open:ios
```

In Xcode:

1. Open the `ios/App/App.xcworkspace` workspace.
2. Select the Apple Developer team under **Signing & Capabilities**.
3. Keep the bundle identifier `com.fantachat.app`.
4. Confirm the app name is `FantaChat` and the iOS icon assets are present.
5. Run the app on the connected iPhone.
6. Archive and upload the build to App Store Connect using **Product > Archive**.

The app loads the production FantaChat site at `https://fantachat-app.vercel.app`.
