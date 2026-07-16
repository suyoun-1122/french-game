import 'package:flutter/material.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Yeonjae French Pâtisserie',
      home: const Scaffold(
        body: Center(
          child: Text('Yeonjae French Pâtisserie\nBuild 1'),
        ),
      ),
    );
  }
}
