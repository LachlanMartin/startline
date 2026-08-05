import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  formatStartListGroupTitle,
  groupByStartWave,
  type ExportRegistrationRow,
} from "@/lib/registration-export";

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 28,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#141414",
  },
  header: {
    marginBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: "#141414",
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  meta: {
    fontSize: 9,
    color: "#444444",
    marginBottom: 2,
  },
  waveTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#141414",
    paddingBottom: 3,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#dddddd",
  },
  colBib: { width: "8%" },
  colName: { width: "28%" },
  colCategory: { width: "18%" },
  colGender: { width: "12%" },
  colPhone: { width: "24%" },
  colMed: { width: "10%", textAlign: "right" },
  headerCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textTransform: "uppercase",
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    fontSize: 8,
    color: "#666666",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function StartListDoc(props: {
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
  state: string;
  generatedAt: string;
  rows: ExportRegistrationRow[];
}) {
  const groups = groupByStartWave(props.rows);
  const location = [props.venue, props.city, props.state].filter(Boolean).join(", ");

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.title}>{props.eventTitle}</Text>
          <Text style={styles.meta}>
            {[props.eventDate, location].filter(Boolean).join(" · ")}
          </Text>
          <Text style={styles.meta}>
            Start list · {props.rows.length} athlete{props.rows.length === 1 ? "" : "s"} · Generated{" "}
            {props.generatedAt}
          </Text>
        </View>

        {groups.map((g) => (
          <View key={g.wave}>
            <Text style={styles.waveTitle}>{formatStartListGroupTitle(g)}</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.colBib, styles.headerCell]}>Bib</Text>
              <Text style={[styles.colName, styles.headerCell]}>Name</Text>
              <Text style={[styles.colCategory, styles.headerCell]}>Category</Text>
              <Text style={[styles.colGender, styles.headerCell]}>Gender</Text>
              <Text style={[styles.colPhone, styles.headerCell]}>Emergency phone</Text>
              <Text style={[styles.colMed, styles.headerCell]}>Medical</Text>
            </View>
            {g.rows.map((r) => (
              <View key={r.id} style={styles.row} wrap={false}>
                <Text style={styles.colBib}>{r.bib || "-"}</Text>
                <Text style={styles.colName}>{r.name}</Text>
                <Text style={styles.colCategory}>{r.category || "-"}</Text>
                <Text style={styles.colGender}>{r.gender || "-"}</Text>
                <Text style={styles.colPhone}>{r.emergencyPhone || "-"}</Text>
                <Text style={styles.colMed}>{r.hasMedical ? "Yes" : ""}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Startline</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function buildStartListPdf(opts: {
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string;
  state: string;
  rows: ExportRegistrationRow[];
  generatedAt?: Date;
}): Promise<Buffer> {
  const generatedAt = (opts.generatedAt ?? new Date()).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const buffer = await renderToBuffer(
    <StartListDoc
      eventTitle={opts.eventTitle}
      eventDate={opts.eventDate}
      venue={opts.venue}
      city={opts.city}
      state={opts.state}
      generatedAt={generatedAt}
      rows={opts.rows}
    />,
  );
  return Buffer.from(buffer);
}
