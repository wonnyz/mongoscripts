shellHelper.$readable = function (b) {
	var ret = null;
	[[0, ""], [10, "Kb"], [20, "Mb"], [30, "Gb"]].forEach(function(s) {
		if (b >= Math.pow(2, s[0])) ret = Math.floor(b/Math.pow(2, s[0])*100)/100+s[1];
	});
	return ret;
}

if (!shellHelper.$show_orig) shellHelper.$show_orig = shellHelper.show;

shellHelper.show = function(str) {
	function printsep(arr) { print(arr.join(" | ")); }
	function printline(arr) { print(arr.map(function(l) { return "".pad(l, true, "-"); }).join(" | ")); }

	var $readable = shellHelper.$readable;
	var ismgs = (db.runCommand("ismaster").msg == "isdbgrid");
	var tokumx = (db.serverBuildInfo().tokumxVersion !== undefined);

	function printDBList() {
		var maxlen = 8;
		var res = db.getMongo().getDBs();
		var disp = res.databases.map(function(o) {
			maxlen = Math.max(maxlen, o.name.length);
			var rate=(o.size && o.size > o.sizeOnDisk ? Math.floor(o.sizeOnDisk * 100 / o.size)+"%" : undefined);
			var shardno = (ismgs && o.shards ? Object.keys(o.shards).length : 0);
			var numcols = (o.empty ? 0 : db.getSisterDB(o.name).getCollectionNames().length);
			return {
				name:o.name,
				size: $readable(o.sizeOnDisk),
				rate:rate,
				empty: o.empty,
				numcols: numcols,
				shardno: shardno
			};
		}).sort(function(a,b){ return (a.name < b.name ? -1 : (a.name == b.name ? 0 : 1)); });
		printsep([
			"database".pad(maxlen, true),
			"numColls",
			"sizeOnDisk".pad(15),
			"shardNo"
		]);
		printline([maxlen, 8, 15, 7]);
		disp.forEach(function(o) {
			var prt = [o.name.pad(maxlen, true)];
			if (o.empty) {
				prt.push("".pad(8, true, "-"), "".pad(15, true, "-"), "".pad(7, true, "-"));
			} else {
				prt.push(
					(o.numcols + "").pad(8),
					(o.size + (o.rate ? "("+o.rate.pad(3)+")" : "")).pad(15),
					(ismgs && (o.shardno > 0) ? (o.shardno + "").pad(7) : "-------")
				);
			}
			printsep(prt);
		});
	}

	function printColList() {
		var n = db.getCollectionNames();
		var maxlen = 10, maxnlen = 5;
		var disp = n.map(function(colname) {
			maxlen = Math.max(maxlen, colname.length);
			var ret = { name: colname };
			var s = db.getCollection(colname).stats(1);
			if (s.shards) {
				var s1 = s.shards[Object.keys(s.shards)[0]];
				ret.idxf = s1.systemFlags;
				ret.po2f = s1.userFlags;
			} else {
				ret.idxf = s.systemFlags;
				ret.po2f = s.userFlags;
				ret.cap = s.capped;
			}
			ret.count = s.count;
			ret.rsize = $readable(s.size) || "0";
			ret.ssize = $readable(s.storageSize) || "0";
			ret.asize = $readable(Math.round(s.avgObjSize)) || "0";
			ret.isize = $readable(s.totalIndexSize) || "0";
			maxnlen = Math.max( Math.log(s.count) / Math.log(10), maxnlen );
			if (s.storageSize < s.size) ret.rate1 = Math.floor(s.storageSize * 100 / s.size)+"%";
			if (s.totalIndexStorageSize) {
				ret.isize = $readable(s.totalIndexStorageSize);
				if (s.totalIndexSize && s.totalIndexStorageSize < s.totalIndexSize) 
					ret.rate2 = Math.floor(s.totalIndexStorageSize * 100 / s.totalIndexSize)+"%";
			}
			return ret;
		});
		printsep([
			"collection".pad(maxlen, true),
			"flags     ",
			"count".pad(maxnlen),
			"  objSize",
			"     size",
			"    storageSize",
			"      indexSize"
		]);
		printline([maxlen, 10, maxnlen, 9, 9, 15, 15]);
		disp.forEach(function(o) {
			printsep([
				o.name.pad(maxlen, true),
				(o.idxf ? "(idx)":"     ")+(o.po2f ? "(po2)": (o.cap ? "(cap)" : "     ")),
				(o.count+"").pad(maxnlen), 
				o.asize.pad(9),
				o.rsize.pad(9),
				(o.ssize + (o.rate1 ? "("+o.rate1.pad(3)+")" : "")).pad(15),
				(o.isize + (o.rate2 ? "("+o.rate2.pad(3)+")" : "")).pad(15)
			]);
		});
	}

	if (typeof db !== "object") return "not connected";
	if (str == "dbs" || str == "databases") { printDBList(); }
	else if (str == "collections" || str == "tables" || str == "col") { printColList(); }
	else return shellHelper.$show_orig(str);
};
