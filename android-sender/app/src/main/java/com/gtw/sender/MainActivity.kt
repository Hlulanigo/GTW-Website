package com.gtw.sender

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseAuth

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { SenderApp() }
    }
}

@androidx.compose.runtime.Composable
fun SenderApp() {
    MaterialTheme {
        var signedIn by remember { mutableStateOf(FirebaseAuth.getInstance().currentUser != null) }
        if (!signedIn) {
            SignInScreen(onSignedIn = { signedIn = true })
        } else {
            SenderHome(onSignOut = { FirebaseAuth.getInstance().signOut(); signedIn = false })
        }
    }
}

@androidx.compose.runtime.Composable
private fun SignInScreen(onSignedIn: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("GTW Sender", style = MaterialTheme.typography.headlineMedium)
        Text("Send a parcel with someone already going your way.")
        Button(onClick = onSignedIn, modifier = Modifier.fillMaxWidth()) { Text("Continue with Firebase") }
        Text("Connect your Firebase sign-in screen here before release.", style = MaterialTheme.typography.bodySmall)
    }
}

@androidx.compose.runtime.Composable
private fun SenderHome(onSignOut: () -> Unit) {
    var parcels by remember { mutableStateOf<List<ParcelSummary>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        runCatching { ApiClient.api.parcels(FirebaseAuth.getInstance().currentUser?.uid) }
            .onSuccess { parcels = it }
            .onFailure { error = it.message ?: "Unable to load parcels" }
    }
    Scaffold(topBar = { TopAppBar(title = { Text("Sender") }) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { }) { Text("Create parcel") }
                OutlinedButton(onClick = onSignOut) { Text("Sign out") }
            }
            Text("My parcels", style = MaterialTheme.typography.titleLarge)
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(parcels) { parcel ->
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("${parcel.origin} to ${parcel.destination}", style = MaterialTheme.typography.titleMedium)
                            Text("${parcel.status ?: "Pending"}  |  R${parcel.compensation ?: 0}")
                        }
                    }
                }
            }
        }
    }
}
