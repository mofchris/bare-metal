---
id: m6/03-files-and-sockets
title: "Files, descriptors and sockets — how data gets into a process"
objectives:
  - "Explain what a file descriptor is and why files and network connections share one interface"
  - "Explain what a system call costs and why buffering exists"
  - "Explain blocking versus non-blocking I/O and why servers need the second"
sources:
  - "Arpaci-Dusseau & Arpaci-Dusseau, Operating Systems: Three Easy Pieces, ch. 39–40 (files and directories)"
  - "W. Richard Stevens & Stephen Rago, Advanced Programming in the UNIX Environment, 3rd ed., ch. 3 and 14"
  - "Beej's Guide to Network Programming (beej.us/guide/bgnet), sections on sockets and blocking"
---

## What this lesson answers

M4/01 listed reading bytes off disk as the first pipeline stage and moved
straight on. M4/03 explained that opening a file costs a metadata lookup before
any bytes arrive. Neither said what actually happens when a program reads.

This lesson covers that, and then extends it to network connections, because
the operating system deliberately makes those the same thing. That shared
interface is what M12's serving material will be built on.

## What is a file descriptor?

When a process opens a file, the operating system does the work of finding it
and checking permissions, then hands back a small integer. That integer is a
**file descriptor**.

It is a handle, not the file. It indexes a table the kernel keeps for your
process, and the entry holds the real state: which file, what position you have
read up to, and what you are allowed to do with it.

The reason this matters is what else gets a descriptor. Network connections do.
Pipes between processes do. The terminal does. All of them are read from and
written to through the same small set of operations, on the same kind of handle.

So a program that reads from a file and a program that reads from a network
connection are doing the same thing at this level, and code that handles one
can often handle the other. That uniformity is why the serving material later
does not need a separate vocabulary.

## What does a read actually cost?

Reading requires a **system call**: a deliberate switch from your code into the
operating system's code, because only the kernel may touch hardware or the
descriptor table.

That switch is not a function call. The processor changes privilege level,
saves state, enters kernel code, and reverses all of it on the way out. The
cost is on the order of 1 to 2 microseconds, which by M1/02's conversion is
several thousand cycles at 3 GHz.

Compare the alternatives. A cache hit is about 1 nanosecond and a DRAM access
about 100. A system call is roughly ten times more expensive than the DRAM
access and thousands of times more expensive than the cache hit.

That ratio explains **buffering**. Reading a file one byte at a time would cost
a system call per byte, so a language's file library does not do that. It asks
the kernel for a large block, typically 4 to 64 KB, keeps it in the process's
own memory, and serves your small reads from there. One system call then covers
thousands of them.

It also explains M4/03's small-file finding from the other side. A million
small files means a million open-and-close pairs, and each of those is system
calls plus filesystem work, paid before a single useful byte arrives.

## What does the page cache do to all this?

M4/04 introduced the **page cache**: the operating system keeps recently read
file contents in spare RAM.

Connect that to what you now know. Your read is a system call in both cases,
but what happens inside differs enormously. If the page is cached, the kernel
copies from RAM and returns, so the whole operation costs a few microseconds.
If it is not, the kernel must go to the drive, which costs tens to hundreds of
microseconds on an SSD.

So the same line of code can be twenty times slower or faster depending on
something your program never sees and did not decide. This is the mechanism
behind M4/04's warning that epoch one and epoch two measure different things.

## What is a socket, and what makes it harder than a file?

A **socket** is a descriptor representing one end of a network connection. You
read and write it much as you would a file.

One property makes it fundamentally harder. A file has an end and the data is
already there. A network connection has neither guarantee: the bytes you want
may not have arrived yet, and there may be no way to know when or whether they
will.

So what should a read do when nothing has arrived? There are two answers, and
choosing between them shapes the entire design of a server.

**Blocking** means the call does not return until data arrives. The thread
stops. This is simple to write and reason about, and it wastes a thread per
waiting connection.

**Non-blocking** means the call returns immediately, saying "nothing yet". The
thread stays free. This is harder to write, because your program now has to
remember what it was in the middle of doing for every connection.

## How does one thread serve many connections?

The non-blocking approach needs one more piece, or it degenerates into asking
every connection in a loop whether anything has happened, which burns a core
for nothing.

The operating system provides it: a call that takes many descriptors and blocks
until _any one of them_ is ready, then reports which. On Linux this is `epoll`,
on Windows it is I/O completion ports, and the idea is the same.

That single mechanism is what lets one thread handle thousands of connections.
It waits once for all of them rather than once per connection, and it wakes
only when there is real work.

Every asynchronous framework you will meet — Python's `asyncio`, and the
serving systems in M12 — is built on this. When M12 discusses queues,
concurrency and backpressure, this is the layer underneath.

## Check your understanding

A server handles 5000 simultaneous connections, most of them idle at any
moment. Design A dedicates one thread per connection, each doing blocking
reads. Design B uses one thread with non-blocking sockets and a readiness call.

Give two distinct reasons Design A scales badly, drawing on this lesson and
lesson 01. A correct answer names two of: 5000 threads means 5000 stacks and
kernel structures, which is a large fixed memory cost for threads that are
mostly doing nothing; the scheduler must manage 5000 runnable-or-blocked
threads, and each context switch costs a microsecond plus cache refill; and
almost all of those threads are parked inside a blocking read, so the thread —
an expensive resource — is being used purely as a bookmark for a connection
that has sent nothing.
