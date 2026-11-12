# Credential Manager finds its Google Play services provider by reflection;
# keep it if release builds are ever minified (Android's passkey guide).
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** {
  *;
}
