package com.docvision.ultra.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.*
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import android.content.ComponentName

/**
 * DocVision Glance App Widget showing recent scans and a quick scan action.
 */
class DocVisionWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            WidgetContent(context)
        }
    }

    @Composable
    private fun WidgetContent(context: Context) {
        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(ColorProvider(android.graphics.Color.parseColor("#F5F6FA")))
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "DocVision Recent Scans",
                style = TextStyle(
                    color = ColorProvider(android.graphics.Color.DKGRAY),
                    fontWeight = FontWeight.Bold
                ),
                modifier = GlanceModifier.padding(bottom = 12.dp)
            )
            
            // Grid of recent scans (2x2 mock layout)
            Row(modifier = GlanceModifier.fillMaxWidth().padding(bottom = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                ItemBox("Invoice.pdf", "#E3F2FD")
                Spacer(modifier = GlanceModifier.width(8.dp))
                ItemBox("Receipt.png", "#E3F2FD")
            }
            Row(modifier = GlanceModifier.fillMaxWidth().padding(bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                ItemBox("Contract.pdf", "#E3F2FD")
                Spacer(modifier = GlanceModifier.width(8.dp))
                ItemBox("ID_Card.jpg", "#E3F2FD")
            }
            
            Spacer(modifier = GlanceModifier.defaultWeight())
            
            // Quick Scan Action
            Box(
                modifier = GlanceModifier
                    .background(ColorProvider(android.graphics.Color.parseColor("#1557b0")))
                    .padding(horizontal = 24.dp, vertical = 12.dp)
                    .clickable(actionStartActivity(ComponentName(context, "com.docvision.ultra.MainActivity"))),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Scan Document",
                    style = TextStyle(
                        color = ColorProvider(android.graphics.Color.WHITE),
                        fontWeight = FontWeight.Medium
                    )
                )
            }
        }
    }

    @Composable
    private fun ItemBox(name: String, bgColorHex: String) {
        Box(
            modifier = GlanceModifier
                .size(70.dp)
                .background(ColorProvider(android.graphics.Color.parseColor(bgColorHex)))
                .padding(8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = name,
                style = TextStyle(
                    color = ColorProvider(android.graphics.Color.parseColor("#1E2433")),
                    fontSize = androidx.glance.text.TextDefaults.defaultTextSize
                )
            )
        }
    }
}
